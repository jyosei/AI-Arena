from django.db.models import Count, F, Max, Q
from django.db.models.functions import Coalesce, Greatest
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework import serializers as drf_serializers  # typing help
from rest_framework.request import Request
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ForumComment, ForumCommentLike, ForumPost, ForumPostImage, ForumPostLike, ForumCommentImage
from users.models import Notification
from .serializers import (
    ForumCommentCreateSerializer,
    ForumCommentSerializer,
    ForumPostCreateSerializer,
    ForumPostDetailSerializer,
    ForumPostListSerializer,
)


class ForumPostPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class ForumPostViewSet(viewsets.ModelViewSet):
    queryset = ForumPost.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = ForumPostPagination

    def get_permissions(self):
        if self.action in {"create", "like"}:
            permission_classes = [permissions.IsAuthenticated]
        else:
            permission_classes = [permissions.AllowAny]
        return [permission() for permission in permission_classes]

    # 类型检查器有时会误判返回类型；提供明确返回注解
    def get_serializer_class(self) -> type[drf_serializers.BaseSerializer]:  # type: ignore[override]
        if self.action == "list":
            return ForumPostListSerializer
        if self.action == "create":
            return ForumPostCreateSerializer
        return ForumPostDetailSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = ForumPost.objects.all().select_related("author").prefetch_related("images")

        if getattr(self, "action", None) == "retrieve":
            qs = qs.prefetch_related("comments__author", "comments__comment_likes")

        qs = qs.annotate(
            comments_count=Count("comments", distinct=True),
            likes_count=Count("post_likes", distinct=True),
            last_comment_at=Max("comments__created_at"),
        ).annotate(
            last_activity=Greatest(
                F("updated_at"),
                Coalesce("last_comment_at", F("updated_at")),
            )
        )

        request: Request | None = getattr(self, "request", None)  # runtime DRF Request
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            qs = qs.annotate(
                is_liked=Count(
                    "post_likes",
                    filter=Q(post_likes__user=request.user),
                    distinct=True,
                )
            )
        # 为兼容类型检查，安全访问 query_params
        qp = {}
        if request and hasattr(request, "query_params"):
            qp = request.query_params  # type: ignore[assignment]
        category = qp.get("category") if isinstance(qp, dict) else qp.get("category")
        if category and category != "all":
            qs = qs.filter(category=category)
        search = qp.get("search") if isinstance(qp, dict) else qp.get("search")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(content__icontains=search))
        sort = qp.get("sort", "latest") if isinstance(qp, dict) else qp.get("sort", "latest")
        if sort == "latest":
            qs = qs.order_by("-is_sticky", "-last_activity", "-created_at")
        elif sort == "newest":
            qs = qs.order_by("-is_sticky", "-created_at")
        elif sort == "hot":
            qs = qs.order_by("-is_sticky", "-likes_count", "-views")
        else:
            qs = qs.order_by("-is_sticky", "-last_activity", "-created_at")

        return qs

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
        ForumPost.objects.filter(pk=pk).update(views=F("views") + 1)
        instance = self.get_queryset().get(pk=pk)
        serializer = self.get_serializer(instance, context={"request": request})
        return Response(serializer.data)

    def perform_create(self, serializer):
        post = serializer.save()
        files = self.request.FILES.getlist("images")
        for uploaded in files:
            ForumPostImage.objects.create(post=post, image=uploaded)

    def create(self, request, *args, **kwargs):
        clean_data = {key: value for key, value in request.data.items() if key != "images"}
        serializer = self.get_serializer(data=clean_data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        detail_serializer = ForumPostDetailSerializer(
            serializer.instance,
            context={"request": request},
        )
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"], url_path="like", permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = ForumPostLike.objects.get_or_create(post=post, user=request.user)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True
            # 创建点赞通知（避免自己点赞自己）
            if post.author_id != request.user.id:
                Notification.create(
                    recipient=post.author,
                    actor=request.user,
                    action_type="post_like",
                    post=post,
                )
        likes_count = ForumPostLike.objects.filter(post=post).count()
        return Response({"liked": liked, "likes_count": likes_count})


class ForumCommentListCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self, post_id):
        return (
            ForumComment.objects.filter(post_id=post_id)
            .select_related("author")
            .prefetch_related("comment_likes")
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
        # 评论 / 回复 通知
        try:
            # 某些类型检查器可能错误推断 comment 类型，使用 getattr 访问并忽略返回类型
            parent_id = getattr(comment, 'parent_id', None)
            if parent_id is None:
                # 顶级评论 -> 通知帖子作者
                post_author_id = getattr(post, 'author_id', None)
                if post_author_id is not None and post_author_id != request.user.id:
                    Notification.create(
                        recipient=post.author,
                        actor=request.user,
                        action_type="post_comment",
                        post=post,
                        comment=comment,  # type: ignore[arg-type]
                    )
            else:
                # 回复 -> 通知被回复评论作者
                parent_comment = getattr(comment, 'parent', None)
                parent_author = getattr(parent_comment, 'author', None)
                if parent_author and parent_author.id != request.user.id:
                    Notification.create(
                        recipient=parent_author,
                        actor=request.user,
                        action_type="comment_reply",
                        post=post,
                        comment=comment,  # type: ignore[arg-type]
                    )
        except Exception:
            # 通知创建失败不影响主流程
            pass
        output = ForumCommentSerializer(comment, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class ForumCommentLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, comment_id):
        comment = ForumComment.objects.get(pk=comment_id)
        like, created = ForumCommentLike.objects.get_or_create(comment=comment, user=request.user)
        if not created:
            like.delete()
            liked = False
        else:
            liked = True
            # 评论点赞通知
            author_id = getattr(comment, 'author_id', None)
            if author_id is not None and author_id != request.user.id:
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
