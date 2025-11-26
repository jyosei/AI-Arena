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
import qrcode
from io import BytesIO

# 尝试兼容可选的模型/权限/序列化器
try:
    from users.models import Notification
except Exception:
    Notification = None

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


class ForumCommentViewSet(viewsets.ModelViewSet):
    queryset = ForumComment.objects.all()
    serializer_class = ForumCommentSerializer
    permission_classes = [permissions.AllowAny]


class ForumPostViewSet(viewsets.ModelViewSet):
    # 基于两边实现合并：尽量兼容多种字段命名/关系（views/view_count、comments_count/comment_count、attachments/images 等）
    queryset = ForumPost.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = ForumPostPagination

    def get_permissions(self):
        # 优先使用更严格的权限类（如果存在），否则回退为 AllowAny / IsAuthenticated
        if IsAuthorOrReadOnly is not None:
            base = [IsAuthorOrReadOnly()]
        else:
            base = [permissions.AllowAny()]

        if self.action in {"create", "like", "reactions", "comments"}:
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
            # 支持 id/slug/name
            category_filter = Q(category__slug__iexact=category) | Q(category__name__iexact=category)
            if category.isdigit():
                category_filter |= Q(category_id=int(category))
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
        headers = self.get_success_headers(serializer.data)
        detail_serializer = ForumPostDetailSerializer(
            serializer.instance,
            context={"request": request},
        )
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
            queryset = (
                post.comments.filter(parent__isnull=True)
                .select_related("author")
                .prefetch_related(
                    "attachments",
                    "children",
                    "children__author",
                    "children__attachments",
                    "reactions",
                    "children__reactions",
                )
                .order_by("created_at")
            )
            serializer = ForumCommentSerializer(queryset, many=True, context={"request": request})
            return Response(serializer.data)

        # POST -> 创建评论
        serializer = ForumCommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        if parent and parent.post_id != post.id:
            return Response({"detail": "父级评论不属于当前帖子。"}, status=status.HTTP_400_BAD_REQUEST)
        comment = serializer.save(post=post, author=request.user)
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
        out_serializer = ForumCommentSerializer(comment, context={"request": request})
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="qrcode", permission_classes=[permissions.AllowAny])
    def qrcode_image(self, request, pk=None):
        """生成帖子的二维码图片"""
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
        serializer = ForumCommentCreateSerializer(
            data=request.data,
            context={"request": request, "post": post},
        )
        serializer.is_valid(raise_exception=True)
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


