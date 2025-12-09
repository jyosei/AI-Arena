import json

from django.contrib.auth import get_user_model
from django.db.models import Count, F, Max, Q
from django.db.models.functions import Coalesce, Greatest
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework import serializers as drf_serializers  # typing help
from rest_framework.request import Request
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from io import BytesIO

try:
    import qrcode  # type: ignore
except ImportError:  # pragma: no cover - 环境缺失时回退
    qrcode = None

# 尝试兼容可选的模型/权限/序列化器
try:
    from users.models import Notification, PrivateChatThread, PrivateMessage, UserFollow
except Exception:
    Notification = None
    PrivateChatThread = None
    PrivateMessage = None
    UserFollow = None

from . import models as forum_models

# 将常用模型绑定为变量，缺失的模型使用 None 回退以兼容不同分支的模型命名
ForumCategory = forum_models.ForumCategory
ForumTag = forum_models.ForumTag
ForumAttachment = getattr(forum_models, "ForumAttachment", None)
ForumPost = forum_models.ForumPost
ForumPostImage = getattr(forum_models, "ForumPostImage", None)
ForumPostLike = getattr(forum_models, "ForumPostLike", None)
ForumPostReaction = getattr(forum_models, "ForumPostReaction", None)
ForumComment = forum_models.ForumComment
ForumCommentLike = getattr(forum_models, "ForumCommentLike", None)
ForumCommentReaction = getattr(forum_models, "ForumCommentReaction", None)
ForumCommentImage = getattr(forum_models, "ForumCommentImage", None)
ForumShareLog = getattr(forum_models, "ForumShareLog", None)
ForumPostFavorite = getattr(forum_models, "ForumPostFavorite", None)
ForumPostViewHistory = getattr(forum_models, "ForumPostViewHistory", None)
ForumPostShare = getattr(forum_models, "ForumPostShare", None)

UserModel = get_user_model()

try:
    from .permissions import IsAuthorOrReadOnly
except Exception:
    IsAuthorOrReadOnly = None

from .serializers import (
    ForumCommentCreateSerializer,
    ForumCommentSerializer,
    ForumPostCreateSerializer,
    ForumPostDetailSerializer,
    ForumPostListSerializer,
    ForumCategorySerializer,
    ForumTagSerializer,
    ForumAttachmentSerializer,
    PostReactionSerializer,
    CommentReactionSerializer,
)


class ForumPostPagination(PageNumberPagination):
    # 兼容两边，使用较大的默认 page size
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class ForumCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForumCategory.objects.all()
    serializer_class = ForumCategorySerializer
    permission_classes = [permissions.AllowAny]


class ForumTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForumTag.objects.all()
    serializer_class = ForumTagSerializer
    permission_classes = [permissions.AllowAny]


class ForumAttachmentViewSet(viewsets.ModelViewSet):
    queryset = ForumAttachment.objects.all() if ForumAttachment is not None else []
    serializer_class = ForumAttachmentSerializer
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(uploader=self.request.user if self.request.user.is_authenticated else None)


class ForumCommentViewSet(viewsets.ModelViewSet):
    queryset = ForumComment.objects.all()
    serializer_class = ForumCommentSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.AllowAny()]
        if self.action in {"create", "update", "partial_update", "destroy"}:
            if IsAuthorOrReadOnly is not None:
                return [IsAuthorOrReadOnly()]
            return [permissions.IsAuthenticated()]
        if self.action in {"reactions"}:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="reactions", permission_classes=[permissions.IsAuthenticated])
    def reactions(self, request, pk=None):
        """评论统一互动接口，当前支持 like。"""
        comment = self.get_object()
        reaction_type = request.data.get("type", "like")
        action = request.data.get("action", "toggle")

        if reaction_type != "like":
            return Response({"detail": "不支持的反应类型"}, status=status.HTTP_400_BAD_REQUEST)

        # 优先旧的 Like 模型；回退到 Reaction
        if ForumCommentLike is not None:
            like, created = ForumCommentLike.objects.get_or_create(comment=comment, user=request.user)
            active = created
            if action == "toggle" and not created:
                like.delete()
                active = False
            like_count = ForumCommentLike.objects.filter(comment=comment).count()
            # 同步统计字段（若存在）
            try:
                ForumComment.objects.filter(pk=comment.pk).update(like_count=like_count)
            except Exception:
                pass
            return Response({"active": active, "like_count": like_count})

        if ForumCommentReaction is not None:
            reaction, created = ForumCommentReaction.objects.get_or_create(
                comment=comment, user=request.user, reaction_type="like"
            )
            active = created
            if action == "toggle" and not created:
                reaction.delete()
                active = False
            like_count = ForumCommentReaction.objects.filter(comment=comment, reaction_type="like").count()
            try:
                ForumComment.objects.filter(pk=comment.pk).update(like_count=like_count)
            except Exception:
                pass
            return Response({"active": active, "like_count": like_count})

        return Response({"detail": "Like 模型不可用"}, status=status.HTTP_400_BAD_REQUEST)


class ForumPostViewSet(viewsets.ModelViewSet):
    # 基于两边实现合并：尽量兼容多种字段命名/关系（views/view_count、comments_count/comment_count、attachments/images 等）
    queryset = ForumPost.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = ForumPostPagination

    def get_permissions(self):
        action = getattr(self, "action", None)
        if action in {"share", "increment_view"}:
            return [permissions.AllowAny()]
        # 优先使用更严格的权限类（如果存在），否则回退为 AllowAny / IsAuthenticated
        if IsAuthorOrReadOnly is not None:
            base = [IsAuthorOrReadOnly()]
        else:
            base = [permissions.AllowAny()]

        if action in {"create", "like", "reactions", "comments"}:
            return [permissions.IsAuthenticated()]
        return base

    def get_serializer_class(self) -> type[drf_serializers.BaseSerializer]:  # type: ignore[override]
        if self.action == "list":
            return ForumPostListSerializer
        if self.action == "create":
            return ForumPostCreateSerializer
        return ForumPostDetailSerializer

    def _annotate_activity(self, qs):
        # 尝试为不同实现做注解（comments/reactions）
        qs = qs.annotate(
            comments_count=Count("comments", distinct=True),
            likes_count=Count("reactions", filter=Q(reactions__reaction_type="like"), distinct=True),
            favorites_count=Count("post_favorites", distinct=True),
            last_comment_at=Max("comments__created_at"),
        )
        qs = qs.annotate(
            last_activity=Greatest(F("updated_at"), Coalesce("last_comment_at", F("updated_at")))
        )
        return qs

    def get_queryset(self):
        qs = ForumPost.objects.all().select_related("author", "category_obj").prefetch_related(
            "images", "attachments", "tags"
        )

        # 在 retrieve 请求时预取评论的作者与回复信息
        if getattr(self, "action", None) == "retrieve":
            qs = qs.prefetch_related(
                "comments__author",
                "comments__comment_likes",
                "comments__attachments",
                "comments__reactions",
            )

        qs = self._annotate_activity(qs)

        request: Request | None = getattr(self, "request", None)
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            qs = qs.annotate(
                is_liked=Count(
                    "reactions",
                    filter=Q(reactions__user=request.user, reactions__reaction_type="like"),
                    distinct=True,
                )
            ).annotate(
                is_favorited=Count(
                    "post_favorites",
                    filter=Q(post_favorites__user=request.user),
                    distinct=True,
                )
            )

        # 兼容多种查询参数
        if request and hasattr(request, "query_params"):
            qp = request.query_params
        else:
            qp = {}

        category = qp.get("category")
        tag = qp.get("tag") or qp.get("tags")
        author = qp.get("author")
        search = qp.get("search")
        sort = qp.get("sort") or qp.get("ordering") or qp.get("ordering")

        if category and category != "all":
            # 支持 id/slug/name/legacy 文本
            category_str = str(category)
            category_filter = (
                Q(category_obj__slug__iexact=category_str)
                | Q(category_obj__name__iexact=category_str)
                | Q(legacy_category__iexact=category_str)
            )
            if category_str.isdigit():
                category_filter |= Q(category_obj_id=int(category_str))
            qs = qs.filter(category_filter)

        if tag:
            qs = qs.filter(Q(tags__name__iexact=tag) | Q(tags__slug__iexact=tag))

        if author:
            author_filter = Q(author__username__iexact=author)
            if author.isdigit():
                author_filter |= Q(author_id=int(author))
            qs = qs.filter(author_filter)

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(content__icontains=search))

        if sort in ("latest", "last_activity"):
            qs = qs.order_by("-last_activity")
        elif sort in ("newest", "created"):
            qs = qs.order_by("-created_at")
        elif sort in ("hot", "most_viewed"):
            # 兼容不同字段名
            if "view_count" in [f.name for f in ForumPost._meta.get_fields()]:
                qs = qs.order_by("-is_sticky", "-view_count")
            else:
                qs = qs.order_by("-is_sticky", "-views")
        else:
            qs = qs.order_by("-is_sticky", "-last_activity", "-created_at")

        return qs.distinct()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    @method_decorator(never_cache)
    def retrieve(self, request, *args, **kwargs):
        pk = kwargs["pk"]
        instance = self.get_queryset().get(pk=pk)
        # 记录浏览历史
        if request.user.is_authenticated:
            try:
                history, created = ForumPostViewHistory.objects.get_or_create(post=instance, user=request.user)
                if not created:
                    ForumPostViewHistory.objects.filter(pk=history.pk).update(view_count=F("view_count") + 1)
            except Exception:
                pass
        serializer = self.get_serializer(instance, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="view", permission_classes=[permissions.AllowAny])
    def increment_view(self, request, pk=None):
        """增加帖子浏览量"""
        # 兼容不同字段名：尝试 update view_count，否则更新 views
        if hasattr(ForumPost, "_meta"):
            if any(f.name == "view_count" for f in ForumPost._meta.get_fields()):
                ForumPost.objects.filter(pk=pk).update(view_count=F("view_count") + 1)
                post = ForumPost.objects.get(pk=pk)
                return Response({"view_count": post.view_count})
            else:
                ForumPost.objects.filter(pk=pk).update(views=F("views") + 1)
                post = ForumPost.objects.get(pk=pk)
                return Response({"view_count": post.views})
        return Response({"detail": "更新失败"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="share", permission_classes=[permissions.AllowAny])
    def share(self, request, pk=None):
        # 避免触发对象级权限限制，直接按主键获取帖子
        post = get_object_or_404(ForumPost.objects.select_related("author"), pk=pk)
        raw_targets = request.data.get("targets")
        if raw_targets in (None, "", []):
            raw_targets = request.data.get("target_ids")
        channel_raw = request.data.get("channel")
        channel = (str(channel_raw).strip()[:32]) if channel_raw else ""

        def normalize_targets(value):
            if value in (None, "", [], (), {}):
                return []
            if isinstance(value, (list, tuple)):
                return list(value)
            if isinstance(value, str):
                candidate = value.strip()
                if not candidate:
                    return []
                try:
                    parsed = json.loads(candidate)
                except json.JSONDecodeError:
                    # 回退：用逗号分割简单列表或视为单个ID
                    if "," in candidate:
                        return [item.strip() for item in candidate.split(",") if item.strip()]
                    return [candidate]
                if isinstance(parsed, (list, tuple)):
                    return list(parsed)
                if parsed in (None, ""):
                    return []
                return [parsed]
            return [value]

        targets = normalize_targets(raw_targets)
        # 兼容旧版：没有 targets 时仅统计分享次数
        if not targets:
            try:
                ForumPost.objects.filter(pk=post.pk).update(share_count=Coalesce(F("share_count"), 0) + 1)
                post.refresh_from_db(fields=["share_count"])
                if ForumShareLog is not None:
                    try:
                        ForumShareLog.objects.create(
                            post=post,
                            user=request.user if request.user.is_authenticated else None,
                            channel=channel,
                        )
                    except Exception:
                        pass
                return Response({"share_count": post.share_count})
            except Exception:
                return Response({"detail": "分享计数失败"}, status=status.HTTP_400_BAD_REQUEST)

        if ForumPostShare is None or UserFollow is None:
            return Response({"detail": "当前环境未启用好友分享扩展"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        if not request.user.is_authenticated:
            return Response({"detail": "请先登录后再指定好友分享"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            target_ids = [int(t) for t in targets if str(t).strip()]
        except (TypeError, ValueError):
            return Response({"detail": "targets 参数包含非法ID"}, status=status.HTTP_400_BAD_REQUEST)

        note = (request.data.get("note") or "").strip()
        candidates = (
            UserModel.objects.filter(id__in=target_ids)
            .exclude(id=request.user.id)
        )

        valid_targets = [user for user in candidates if UserFollow.is_mutual(request.user, user)]
        if not valid_targets:
            return Response({"detail": "请选择互相关注的好友进行分享"}, status=status.HTTP_400_BAD_REQUEST)

        created_records = []
        for target in valid_targets:
            share_record = ForumPostShare.objects.create(
                post=post,
                sender=request.user,
                receiver=target,
                note=note,
            )
            created_records.append(share_record)
            if Notification is not None:
                Notification.create(recipient=target, actor=request.user, action_type="post_share", post=post)
            if PrivateChatThread is not None and PrivateMessage is not None:
                try:
                    thread, _ = PrivateChatThread.get_or_create_between(request.user, target)
                    content_parts = [f"{request.user.username} 向你分享了帖子《{post.title}》 (ID: {post.pk})"]
                    if note:
                        content_parts.append("")
                        content_parts.append(note)
                    PrivateMessage.objects.create(
                        thread=thread,
                        sender=request.user,
                        content="\n".join(content_parts),
                    )
                except Exception:
                    pass

        ForumPost.objects.filter(pk=post.pk).update(share_count=Coalesce(F("share_count"), 0) + len(created_records))
        if ForumShareLog is not None:
            for record in created_records:
                try:
                    ForumShareLog.objects.create(
                        post=post,
                        user=request.user,
                        channel=channel,
                    )
                except Exception:
                    continue

        response_payload = [
            {
                "receiver_id": record.receiver_id,
                "created_at": record.created_at,
            }
            for record in created_records
        ]
        return Response({"shared": len(created_records), "results": response_payload})

    def perform_create(self, serializer):
        post = serializer.save(author=getattr(self.request, "user", None))
        # 兼容上传图片/附件
        files = getattr(self.request, "FILES", None)
        if files is not None:
            images = files.getlist("images") if "images" in files else []
            for uploaded in images:
                try:
                    ForumPostImage.objects.create(post=post, image=uploaded)
                except Exception:
                    pass
            attachments = files.getlist("attachments") if "attachments" in files else []
            for f in attachments:
                try:
                    ForumAttachment.objects.create(post=post, file=f)
                except Exception:
                    pass

    def create(self, request, *args, **kwargs):
        # 移除文件字段以便验证器正常工作
        clean_data = {key: value for key, value in request.data.items() if key not in ("images", "attachments")}
        serializer = self.get_serializer(data=clean_data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # 使用 detail_serializer 获取完整数据,避免 ManyToMany 序列化问题
        detail_serializer = ForumPostDetailSerializer(
            serializer.instance,
            context={"request": request},
        )
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"], url_path="like")
    def like(self, request, pk=None):
        post = self.get_object()
        # 尝试旧的 Like 模型；回退到 Reaction
        if ForumPostLike is not None:
            like, created = ForumPostLike.objects.get_or_create(post=post, user=request.user)
            if not created:
                like.delete()
                liked = False
            else:
                liked = True
                if Notification is not None and getattr(post, "author_id", None) != request.user.id:
                    try:
                        Notification.create(
                            recipient=post.author,
                            actor=request.user,
                            action_type="post_like",
                            post=post,
                        )
                    except Exception:
                        pass
            likes_count = ForumPostLike.objects.filter(post=post).count()
            return Response({"liked": liked, "likes_count": likes_count})

        # 使用 Reaction
        if ForumPostReaction is not None:
            reaction, created = ForumPostReaction.objects.get_or_create(post=post, user=request.user, reaction_type="like")
            if not created:
                reaction.delete()
                liked = False
            else:
                liked = True
            likes_count = ForumPostReaction.objects.filter(post=post, reaction_type="like").count()
            return Response({"liked": liked, "likes_count": likes_count})

        return Response({"detail": "Like 模型不可用"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post", "get"], url_path="comments")
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method.lower() == "get":
            from django.db.models import Prefetch
            
            # 递归预取所有层级的子评论
            def get_children_prefetch(depth=5):
                """递归构建预取查询，最多5层深度"""
                if depth == 0:
                    return ForumComment.objects.select_related("author").prefetch_related("attachments", "reactions")
                
                return ForumComment.objects.select_related("author").prefetch_related(
                    "attachments",
                    "reactions",
                    Prefetch("children", queryset=get_children_prefetch(depth - 1))
                )
            
            queryset = (
                post.comments.filter(parent__isnull=True)
                .select_related("author")
                .prefetch_related(
                    "attachments",
                    "reactions",
                    Prefetch("children", queryset=get_children_prefetch(4))
                )
                .order_by("created_at")
            )
            serializer = ForumCommentSerializer(queryset, many=True, context={"request": request})
            return Response(serializer.data)

        # POST -> 创建评论
        create_serializer = ForumCommentCreateSerializer(
            data=request.data,
            context={"request": request, "post": post},
        )
        create_serializer.is_valid(raise_exception=True)
        parent = create_serializer.validated_data.get("parent")
        if parent and parent.post_id != post.id:
            return Response({"detail": "父级评论不属于当前帖子。"}, status=status.HTTP_400_BAD_REQUEST)
        comment = create_serializer.save()
        # 更新统计/活跃度兼容字段
        try:
            if hasattr(post, "comment_count"):
                post.comment_count = post.comments.filter(is_deleted=False).count()
                post.last_activity_at = timezone.now()
                post.save(update_fields=["comment_count", "last_activity_at"])
            else:
                post.comments_count = post.comments.filter(is_deleted=False).count()
                post.last_activity = timezone.now()
                post.save()
        except Exception:
            pass
        
        # 重新查询评论以获取完整的预取数据
        comment = ForumComment.objects.filter(pk=comment.pk).select_related("author").prefetch_related("attachments", "reactions").first()
        out_serializer = ForumCommentSerializer(comment, context={"request": request})
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="favorite", permission_classes=[permissions.IsAuthenticated])
    def favorite(self, request, pk=None):
        post = self.get_object()
        if ForumPostFavorite is None:
            return Response({"detail": "收藏功能不可用"}, status=status.HTTP_400_BAD_REQUEST)
        fav, created = ForumPostFavorite.objects.get_or_create(post=post, user=request.user)
        if not created:
            fav.delete()
            favorited = False
        else:
            favorited = True
            if Notification and post.author_id != request.user.id:
                try:
                    Notification.create(
                        recipient=post.author,
                        actor=request.user,
                        action_type="post_favorite",
                        post=post,
                    )
                except Exception:
                    pass
        favorites_count = ForumPostFavorite.objects.filter(post=post).count()
        return Response({"favorited": favorited, "favorites_count": favorites_count})

    @action(detail=True, methods=["post"], url_path="reactions", permission_classes=[permissions.IsAuthenticated])
    def reactions(self, request, pk=None):
        """统一的反应接口,支持like和favorite"""
        post = self.get_object()
        reaction_type = request.data.get('type', 'like')
        action = request.data.get('action', 'toggle')
        
        if reaction_type == 'like':
            if ForumPostLike is not None:
                like, created = ForumPostLike.objects.get_or_create(post=post, user=request.user)
                if action == 'toggle':
                    if not created:
                        like.delete()
                        active = False
                    else:
                        active = True
                else:
                    active = created
                like_count = ForumPostLike.objects.filter(post=post).count()
                return Response({"active": active, "like_count": like_count})
            elif ForumPostReaction is not None:
                reaction, created = ForumPostReaction.objects.get_or_create(
                    post=post, user=request.user, reaction_type="like"
                )
                if action == 'toggle' and not created:
                    reaction.delete()
                    active = False
                else:
                    active = created
                like_count = ForumPostReaction.objects.filter(post=post, reaction_type="like").count()
                return Response({"active": active, "like_count": like_count})
                
        elif reaction_type == 'favorite':
            if ForumPostFavorite is None:
                return Response({"detail": "收藏功能不可用"}, status=status.HTTP_400_BAD_REQUEST)
            fav, created = ForumPostFavorite.objects.get_or_create(post=post, user=request.user)
            if action == 'toggle' and not created:
                fav.delete()
                active = False
            else:
                active = created
            favorite_count = ForumPostFavorite.objects.filter(post=post).count()
            return Response({"active": active, "favorite_count": favorite_count})
        
        return Response({"detail": "不支持的反应类型"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="qrcode", permission_classes=[permissions.AllowAny])
    def qrcode_image(self, request, pk=None):
        """生成帖子的二维码图片"""
        if qrcode is None:
            return Response({"detail": "未安装 qrcode 库，无法生成二维码"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        post = self.get_object()
        # 构建分享链接
        host = request.get_host()
        protocol = 'https' if request.is_secure() else 'http'
        share_url = f"{protocol}://{host}/forum/post/{post.id}"
        
        # 生成二维码
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(share_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # 保存到字节流
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        # 返回图片
        response = HttpResponse(buffer, content_type='image/png')
        response['Content-Disposition'] = f'inline; filename="qrcode-post-{post.id}.png"'
        return response

class ForumCommentListCreateView(APIView):
    # 兼容旧路由：保留 APIView 方式
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self, post_id):
        return (
            ForumComment.objects.filter(post_id=post_id)
            .select_related("author")
            .prefetch_related("comment_likes", "attachments", "reactions")
        )

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get(self, request, post_id):
        get_object_or_404(ForumPost, pk=post_id)
        queryset = self.get_queryset(post_id).annotate(likes_count=Count("comment_likes", distinct=True))
        if request.user.is_authenticated:
            queryset = queryset.annotate(
                is_liked=Count(
                    "comment_likes",
                    filter=Q(comment_likes__user=request.user),
                    distinct=True,
                )
            )
        serializer = ForumCommentSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, post_id):
        post = get_object_or_404(ForumPost, pk=post_id)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[DEBUG] Comment data: {dict(request.data)}")
        serializer = ForumCommentCreateSerializer(
            data=request.data,
            context={"request": request, "post": post},
        )
        serializer.is_valid(raise_exception=True)
        logger.error(f"[DEBUG] Validated: {serializer.validated_data}")
        comment = serializer.save()
        # 通知：兼容旧 Notification
        try:
            parent_id = getattr(comment, "parent_id", None)
            if parent_id is None:
                post_author_id = getattr(post, "author_id", None)
                if post_author_id is not None and post_author_id != request.user.id and Notification is not None:
                    try:
                        Notification.create(
                            recipient=post.author,
                            actor=request.user,
                            action_type="post_comment",
                            post=post,
                            comment=comment,
                        )
                    except Exception:
                        pass
            else:
                parent_comment = getattr(comment, "parent", None)
                parent_author = getattr(parent_comment, "author", None)
                if parent_author and parent_author.id != request.user.id and Notification is not None:
                    try:
                        Notification.create(
                            recipient=parent_author,
                            actor=request.user,
                            action_type="comment_reply",
                            post=post,
                            comment=comment,
                        )
                    except Exception:
                        pass
        except Exception:
            pass
        output = ForumCommentSerializer(comment, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class ForumCommentLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):
        comment = ForumComment.objects.get(pk=comment_id)
        # 优先旧的 Like 模型
        if ForumCommentLike is not None:
            like, created = ForumCommentLike.objects.get_or_create(comment=comment, user=request.user)
            if not created:
                like.delete()
                liked = False
            else:
                liked = True
                author_id = getattr(comment, "author_id", None)
                if author_id is not None and author_id != request.user.id and Notification is not None:
                    try:
                        Notification.create(
                            recipient=comment.author,
                            actor=request.user,
                            action_type="comment_like",
                            post=comment.post,
                            comment=comment,
                        )
                    except Exception:
                        pass
            likes_count = ForumCommentLike.objects.filter(comment=comment).count()
            return Response({"liked": liked, "likes_count": likes_count})

        # 使用 Reaction
        if ForumCommentReaction is not None:
            reaction, created = ForumCommentReaction.objects.get_or_create(comment=comment, user=request.user, reaction_type="like")
            if not created:
                reaction.delete()
                liked = False
            else:
                liked = True
            likes_count = ForumCommentReaction.objects.filter(comment=comment, reaction_type="like").count()
            return Response({"liked": liked, "likes_count": likes_count})

        return Response({"detail": "Like 模型不可用"}, status=status.HTTP_400_BAD_REQUEST)


# User views from HEAD
class UserFavoritesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if ForumPostFavorite is None:
            return Response([], status=status.HTTP_200_OK)
        posts = (
            ForumPost.objects.filter(post_favorites__user=request.user)
            .select_related("author", "category_obj")
            .prefetch_related("tags", "attachments", "images")
            .annotate(
                comments_count=Count("comments", distinct=True),
                likes_count=Count("reactions", filter=Q(reactions__reaction_type="like"), distinct=True),
                favorites_count=Count("post_favorites", distinct=True),
                last_comment_at=Max("comments__created_at"),
            ).annotate(
                last_activity=Greatest(
                    F("updated_at"),
                    Coalesce("last_comment_at", F("updated_at")),
                ),
                is_liked=Count(
                    "reactions",
                    filter=Q(reactions__user=request.user, reactions__reaction_type="like"),
                    distinct=True,
                ),
                is_favorited=Count(
                    "post_favorites",
                    filter=Q(post_favorites__user=request.user),
                    distinct=True,
                ),
            ).order_by("-post_favorites__created_at")
        )
        from .serializers import ForumPostListSerializer
        serializer = ForumPostListSerializer(posts, many=True, context={"request": request})
        return Response(serializer.data)


class UserHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if ForumPostViewHistory is None:
            return Response([], status=status.HTTP_200_OK)
        posts = (
            ForumPost.objects.filter(view_histories__user=request.user)
            .select_related("author", "category_obj")
            .prefetch_related("tags", "attachments", "images")
            .annotate(
                comments_count=Count("comments", distinct=True),
                likes_count=Count("reactions", filter=Q(reactions__reaction_type="like"), distinct=True),
                favorites_count=Count("post_favorites", distinct=True) if ForumPostFavorite else Count("post_favorites", distinct=True),
                last_comment_at=Max("comments__created_at"),
                last_viewed_at=Max("view_histories__last_viewed_at"),
            ).annotate(
                last_activity=Greatest(
                    F("updated_at"),
                    Coalesce("last_comment_at", F("updated_at")),
                ),
                is_liked=Count(
                    "reactions",
                    filter=Q(reactions__user=request.user, reactions__reaction_type="like"),
                    distinct=True,
                ),
                is_favorited=Count(
                    "post_favorites",
                    filter=Q(post_favorites__user=request.user),
                    distinct=True,
                ) if ForumPostFavorite else Count("pk", filter=Q(pk=0)),
            ).order_by("-last_viewed_at")
        )
        from .serializers import ForumPostListSerializer
        serializer = ForumPostListSerializer(posts, many=True, context={"request": request})
        return Response(serializer.data)


class UserLikedPostsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # 获取点赞的帖子
        posts = (
            ForumPost.objects.filter(reactions__user=request.user, reactions__reaction_type="like")
            .select_related("author", "category_obj")
            .prefetch_related("tags", "attachments", "images")
            .annotate(
                comments_count=Count("comments", distinct=True),
                likes_count=Count("reactions", filter=Q(reactions__reaction_type="like"), distinct=True),
                favorites_count=Count("post_favorites", distinct=True) if ForumPostFavorite else Count("pk", filter=Q(pk=0)),
                last_comment_at=Max("comments__created_at"),
            ).annotate(
                last_activity=Greatest(
                    F("updated_at"),
                    Coalesce("last_comment_at", F("updated_at")),
                ),
                is_liked=Count(
                    "reactions",
                    filter=Q(reactions__user=request.user, reactions__reaction_type="like"),
                    distinct=True,
                ),
                is_favorited=Count(
                    "post_favorites",
                    filter=Q(post_favorites__user=request.user),
                    distinct=True,
                ) if ForumPostFavorite else Count("pk", filter=Q(pk=0)),
            ).order_by("-reactions__created_at")
        )
        
        # 获取点赞的评论
        comments = (
            ForumComment.objects.filter(
                Q(comment_likes__user=request.user) if ForumCommentLike else Q(reactions__user=request.user, reactions__reaction_type="like")
            )
            .select_related("author", "post")
            .annotate(
                likes_count=Count("comment_likes", distinct=True) if ForumCommentLike else Count("reactions", filter=Q(reactions__reaction_type="like"), distinct=True),
                is_liked=Count(
                    "comment_likes" if ForumCommentLike else "reactions",
                    filter=Q(comment_likes__user=request.user) if ForumCommentLike else Q(reactions__user=request.user, reactions__reaction_type="like"),
                    distinct=True,
                ),
            ).order_by("-comment_likes__created_at" if ForumCommentLike else "-reactions__created_at")
        )
        
        from .serializers import ForumPostListSerializer, ForumCommentSerializer
        posts_serializer = ForumPostListSerializer(posts, many=True, context={"request": request})
        comments_serializer = ForumCommentSerializer(comments, many=True, context={"request": request})
        return Response({
            "posts": posts_serializer.data,
            "comments": comments_serializer.data,
        })


class UserCommentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        comments = (
            ForumComment.objects.filter(author=request.user)
            .select_related("author", "post")
            .annotate(
                likes_count=Count("comment_likes", distinct=True) if ForumCommentLike else Count("reactions", filter=Q(reactions__reaction_type="like"), distinct=True),
                is_liked=Count(
                    "comment_likes" if ForumCommentLike else "reactions",
                    filter=Q(comment_likes__user=request.user) if ForumCommentLike else Q(reactions__user=request.user, reactions__reaction_type="like"),
                    distinct=True,
                ),
            ).order_by("-created_at")
        )
        from .serializers import ForumCommentSerializer
        serializer = ForumCommentSerializer(comments, many=True, context={"request": request})
        return Response(serializer.data)
