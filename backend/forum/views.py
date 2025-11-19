from django.db.models import F, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    ForumCategory,
    ForumComment,
    ForumCommentReaction,
    ForumAttachment,
    ForumPost,
    ForumPostReaction,
    ForumShareLog,
    ForumTag,
)
from .permissions import IsAuthorOrReadOnly
from .serializers import (
    CommentReactionSerializer,
    ForumCategorySerializer,
    ForumCommentSerializer,
    ForumAttachmentSerializer,
    ForumPostDetailSerializer,
    ForumPostListSerializer,
    ForumTagSerializer,
    PostReactionSerializer,
)


class ForumPostPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class ForumPostViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthorOrReadOnly]
    queryset = (
        ForumPost.objects.select_related("author", "category")
        .prefetch_related("tags", "attachments")
        .all()
    )
    pagination_class = ForumPostPagination

    def get_serializer_class(self):
        if self.action == "list":
            return ForumPostListSerializer
        return ForumPostDetailSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve", "view", "share"}:
            return [AllowAny()]
        if self.action == "create":
            return [IsAuthenticated()]
        if self.action == "comments":
            if self.request.method.lower() == "get":
                return [AllowAny()]
            return [IsAuthenticated()]
        if self.action == "reactions":
            return [IsAuthenticated()]
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        qs = self.queryset
        request = self.request
        category = request.query_params.get("category")
        tag = request.query_params.get("tag")
        author = request.query_params.get("author")
        search = request.query_params.get("search")
        ordering = request.query_params.get("ordering") or request.query_params.get("sort")

        if category and category != "all":
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

        if ordering in ("latest", "last_activity"):
            qs = qs.order_by("-last_activity_at")
        elif ordering in ("newest", "created"):
            qs = qs.order_by("-created_at")
        elif ordering in ("hot", "most_viewed"):
            qs = qs.order_by("-view_count")
        elif ordering in ("most_commented",):
            qs = qs.order_by("-comment_count")
        return qs.distinct()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], permission_classes=[AllowAny])
    def view(self, request, pk=None):
        post = self.get_object()
        ForumPost.objects.filter(pk=post.pk).update(view_count=F("view_count") + 1)
        post.refresh_from_db(fields=["view_count"])
        return Response({"view_count": post.view_count})

    @action(detail=True, methods=["post", "get"], url_path="comments")
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method.lower() == "get":
            top_level = (
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
            serializer = ForumCommentSerializer(top_level, many=True, context={"request": request})
            return Response(serializer.data)

        serializer = ForumCommentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        if parent and parent.post_id != post.id:
            return Response({"detail": "父级评论不属于当前帖子。"}, status=status.HTTP_400_BAD_REQUEST)
        comment = serializer.save(post=post, author=request.user)
        post.comment_count = post.comments.filter(is_deleted=False).count()
        post.last_activity_at = timezone.now()
        post.save(update_fields=["comment_count", "last_activity_at"])
        out_serializer = ForumCommentSerializer(comment, context={"request": request})
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="reactions")
    def reactions(self, request, pk=None):
        post = self.get_object()
        serializer = PostReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reaction_type = serializer.validated_data["type"]
        action_type = serializer.validated_data["action"]

        reaction_qs = ForumPostReaction.objects.filter(
            post=post, user=request.user, reaction_type=reaction_type
        )
        active_before = reaction_qs.exists()
        active_after = active_before

        if action_type == "toggle":
            if active_before:
                reaction_qs.delete()
                active_after = False
            else:
                ForumPostReaction.objects.create(
                    post=post, user=request.user, reaction_type=reaction_type
                )
                active_after = True
        elif action_type == "add":
            if not active_before:
                ForumPostReaction.objects.create(
                    post=post, user=request.user, reaction_type=reaction_type
                )
                active_after = True
        else:  # remove
            if active_before:
                reaction_qs.delete()
                active_after = False

        self._refresh_post_reaction_counts(post)
        return Response(
            {
                "like_count": post.like_count,
                "favorite_count": post.favorite_count,
                "active": active_after,
            }
        )

    def _refresh_post_reaction_counts(self, post: ForumPost):
        post.like_count = post.reactions.filter(
            reaction_type=ForumPostReaction.ReactionType.LIKE
        ).count()
        post.favorite_count = post.reactions.filter(
            reaction_type=ForumPostReaction.ReactionType.FAVORITE
        ).count()
        post.save(update_fields=["like_count", "favorite_count"])
        post.refresh_from_db(fields=["like_count", "favorite_count"])

    @action(detail=True, methods=["post"], permission_classes=[AllowAny])
    def share(self, request, pk=None):
        post = self.get_object()
        channel = request.data.get("channel", "")
        share = ForumShareLog.objects.create(
            post=post,
            user=request.user if request.user.is_authenticated else None,
            channel=channel,
        )
        ForumPost.objects.filter(pk=post.pk).update(share_count=F("share_count") + 1)
        post.refresh_from_db(fields=["share_count"])
        return Response({"share_count": post.share_count, "share_id": share.id})


class ForumCommentViewSet(viewsets.ModelViewSet):
    serializer_class = ForumCommentSerializer
    permission_classes = [IsAuthorOrReadOnly]
    queryset = (
        ForumComment.objects.select_related("author", "post", "parent")
        .prefetch_related("attachments", "children", "children__attachments", "reactions")
        .all()
    )

    def get_permissions(self):
        if self.action in {"retrieve"}:
            return [AllowAny()]
        if self.action == "reactions":
            return [IsAuthenticated()]
        if self.action in {"partial_update", "update", "destroy"}:
            return [IsAuthorOrReadOnly()]
        return super().get_permissions()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.content = ""
        instance.save(update_fields=["is_deleted", "content", "updated_at"])
        post = instance.post
        post.comment_count = post.comments.filter(is_deleted=False).count()
        post.save(update_fields=["comment_count"])

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def reactions(self, request, pk=None):
        comment = self.get_object()
        serializer = CommentReactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reaction_type = serializer.validated_data["type"]
        action_type = serializer.validated_data["action"]
        reaction_qs = ForumCommentReaction.objects.filter(
            comment=comment, user=request.user, reaction_type=reaction_type
        )
        active_before = reaction_qs.exists()
        active_after = active_before

        if action_type == "toggle":
            if active_before:
                reaction_qs.delete()
                active_after = False
            else:
                ForumCommentReaction.objects.create(
                    comment=comment, user=request.user, reaction_type=reaction_type
                )
                active_after = True
        elif action_type == "add":
            if not active_before:
                ForumCommentReaction.objects.create(
                    comment=comment, user=request.user, reaction_type=reaction_type
                )
                active_after = True
        else:  # remove
            if active_before:
                reaction_qs.delete()
                active_after = False

        self._refresh_comment_reaction_counts(comment)
        return Response(
            {
                "like_count": comment.like_count,
                "favorite_count": comment.favorite_count,
                "active": active_after,
            }
        )

    def _refresh_comment_reaction_counts(self, comment: ForumComment):
        comment.like_count = comment.reactions.filter(
            reaction_type=ForumCommentReaction.ReactionType.LIKE
        ).count()
        comment.favorite_count = comment.reactions.filter(
            reaction_type=ForumCommentReaction.ReactionType.FAVORITE
        ).count()
        comment.save(update_fields=["like_count", "favorite_count"])
        comment.refresh_from_db(fields=["like_count", "favorite_count"])


class ForumAttachmentViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = ForumAttachmentSerializer
    permission_classes = [IsAuthenticated]
    queryset = ForumAttachment.objects.select_related("uploader", "post", "comment").order_by("-created_at")
    parser_classes = (MultiPartParser, FormParser)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get("file")
        if uploaded_file is None:
            raise ValidationError({"file": "请上传图片文件。"})
        if not (uploaded_file.content_type or "").startswith("image/"):
            raise ValidationError({"file": "仅支持图片格式的附件。"})
        max_size = 5 * 1024 * 1024
        if uploaded_file.size > max_size:
            raise ValidationError({"file": "附件大小不能超过5MB。"})
        serializer.save(uploader=self.request.user)

    def destroy(self, request, *args, **kwargs):
        attachment = self.get_object()
        if attachment.uploader_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if attachment.post_id or attachment.comment_id:
            return Response(
                {"detail": "附件已被使用，无法删除。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class ForumTagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForumTag.objects.all().order_by("name")
    serializer_class = ForumTagSerializer
    permission_classes = [AllowAny]


class ForumCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForumCategory.objects.filter(is_active=True).order_by("sort_order", "name")
    serializer_class = ForumCategorySerializer
    permission_classes = [AllowAny]
