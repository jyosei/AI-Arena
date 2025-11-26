import json
from typing import Any, Iterable, List
from urllib.parse import urljoin
from uuid import uuid4

from django.conf import settings
from django.db import models
from django.db import transaction
from django.db.models import Count, Q
from django.utils.text import Truncator, slugify
from django.utils import timezone
from rest_framework import serializers

# 尝试兼容不同分支的用户模型引用
try:
    from users.models import User
except Exception:
    User = None

from .models import (
    ForumCategory,
    ForumTag,
    ForumAttachment,
    ForumPost,
    ForumPostImage,
    ForumPostReaction,
    ForumComment,
    ForumCommentLike,
    ForumCommentReaction,
    ForumCommentImage,
)


def build_media_url(request, path) -> str:
    if not path:
        return ""
    path = str(path)
    if path.startswith(("http://", "https://")):
        return path
    if not path.startswith("/"):
        path = f"/{path}"
    media_url = getattr(settings, "MEDIA_URL", "/media/") or "/media/"
    if not media_url.startswith("/"):
        media_url = f"/{media_url}"
    if not media_url.endswith("/"):
        media_url = f"{media_url}/"
    if not path.startswith(media_url) and "/media/" not in path.split("?")[0]:
        path = media_url + path.lstrip("/")
    base = getattr(settings, "MEDIA_BASE_URL", "") or ""
    if base:
        base = base.rstrip("/") + "/"
        return urljoin(base, path.lstrip("/"))
    if request:
        scheme = "https" if request.is_secure() else "http"
        host = request.get_host()
        return f"{scheme}://{host}{path}"
    return path


class UserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(source="pk")
    username = serializers.CharField()
    avatar = serializers.CharField(allow_blank=True, allow_null=True, default="")

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        request = self.context.get("request")
        avatar_raw = getattr(instance, "avatar_url", "") or getattr(instance, "avatar", "")
        rep["avatar"] = build_media_url(request, avatar_raw)
        return rep


class ForumAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User if User is not None else serializers.Serializer
        fields = ("id", "username", "avatar")


class ForumCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ForumCategory
        fields = ("id", "name", "slug", "description", "is_active", "sort_order")


class ForumTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForumTag
        fields = ("id", "name", "slug")


class ForumAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    file = serializers.ImageField(write_only=True, required=True)

    class Meta:
        model = ForumAttachment
        fields = (
            "id",
            "url",
            "file",
            "width",
            "height",
            "content_type",
            "size",
            "created_at",
        )
        read_only_fields = ("id", "url", "width", "height", "content_type", "size", "created_at")

    def validate_file(self, value):
        if not (getattr(value, "content_type", "") or "").startswith("image/"):
            raise serializers.ValidationError("仅支持上传图片文件。")
        if getattr(value, "size", 0) > 5 * 1024 * 1024:
            raise serializers.ValidationError("单张图片大小不能超过 5MB。")
        return value

    def get_url(self, instance):
        if not instance.file:
            return ""
        request = self.context.get("request")
        url = getattr(instance.file, "url", "")
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class ForumPostImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ForumPostImage
        fields = ["id", "image", "image_url", "uploaded_at"]
        read_only_fields = fields

    def get_image_url(self, obj: ForumPostImage) -> str:
        request = self.context.get("request")
        return build_media_url(request, getattr(obj.image, "url", ""))

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        request = self.context.get("request")
        rep_image_raw = rep.get("image") or ""
        rep["image"] = build_media_url(request, rep_image_raw)
        rep["image_url"] = build_media_url(request, rep.get("image_url") or rep_image_raw)
        return rep


class ForumCommentSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = ForumComment
        fields = [
            "id",
            "post",
            "author",
            "content",
            "parent",
            "created_at",
            "updated_at",
            "likes_count",
            "is_liked",
            "images",
        ]
        read_only_fields = [
            "id",
            "post",
            "author",
            "created_at",
            "updated_at",
            "likes_count",
            "is_liked",
        ]

    def get_likes_count(self, obj: ForumComment) -> int:
        return getattr(obj, "likes_count", None) or getattr(obj, "comment_likes", obj.comment_likes).count()  # type: ignore

    def get_is_liked(self, obj: ForumComment) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False
        user = request.user
        if hasattr(obj, "is_liked"):
            return bool(obj.is_liked)
        if hasattr(obj, "comment_likes"):
            return obj.comment_likes.filter(user=user).exists()  # type: ignore
        if hasattr(obj, "reactions"):
            return obj.reactions.filter(user=user, reaction_type="like").exists()  # type: ignore
        return False

    def get_images(self, obj: ForumComment):
        request = self.context.get("request")
        output = []
        for img in getattr(obj, "images", []).all():  # type: ignore
            url = build_media_url(request, getattr(img.image, "url", ""))
            output.append({
                "id": img.pk,
                "image": url,
                "image_url": url,
                "uploaded_at": img.uploaded_at,
            })
        return output


class ForumPostListSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.SerializerMethodField()  # 兼容前端单数命名
    likes_count = serializers.IntegerField(read_only=True)
    like_count = serializers.SerializerMethodField()  # 兼容前端单数命名
    last_activity = serializers.DateTimeField(read_only=True)
    excerpt = serializers.SerializerMethodField()
    favorites_count = serializers.IntegerField(read_only=True)
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "category_obj",
            "tags",
            "is_sticky",
            "view_count",
            "created_at",
            "updated_at",
            "last_activity",
            "comments_count",
            "comment_count",  # 兼容
            "likes_count",
            "like_count",  # 兼容
            "favorites_count",
            "author",
            "excerpt",
            "is_favorited",
        ]
        read_only_fields = fields

    def get_comment_count(self, obj):
        """返回模型的 comment_count 字段值"""
        return obj.comment_count

    def get_like_count(self, obj):
        """返回模型的 like_count 字段值"""
        return obj.like_count

    def get_excerpt(self, obj: ForumPost) -> str:
        return Truncator(obj.content).words(50, truncate="...")

    def get_is_favorited(self, obj: ForumPost) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, "is_favorited"):
            return bool(getattr(obj, "is_favorited"))
        return obj.post_favorites.filter(user=request.user).exists()  # type: ignore[attr-defined]


class ForumPostDetailSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    images = ForumPostImageSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True)
    like_count = serializers.SerializerMethodField()  # 兼容前端
    comments_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.SerializerMethodField()  # 兼容前端
    is_liked = serializers.SerializerMethodField()
    favorites_count = serializers.IntegerField(read_only=True)
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "category_obj",
            "tags",
            "content",
            "is_sticky",
            "view_count",
            "created_at",
            "updated_at",
            "author",
            "images",
            "comments",
            "likes_count",
            "like_count",  # 兼容
            "comments_count",
            "comment_count",  # 兼容
            "is_liked",
            "favorites_count",
            "is_favorited",
        ]
        read_only_fields = fields

    def get_comment_count(self, obj):
        """返回模型的 comment_count 字段值"""
        return obj.comment_count

    def get_like_count(self, obj):
        """返回模型的 like_count 字段值"""
        return obj.like_count

    def get_comments(self, obj: ForumPost) -> Any:
        queryset = obj.comments.select_related("author").annotate(  # type: ignore[attr-defined]
            likes_count=Count("comment_likes", distinct=True)
        )
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            queryset = queryset.annotate(
                is_liked=Count(
                    "comment_likes",
                    filter=Q(comment_likes__user=request.user),
                    distinct=True,
                )
            )
        serialized = ForumCommentSerializer(
            queryset,
            many=True,
            context=self.context,
        )
        return serialized.data

    def get_is_liked(self, obj: ForumPost) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, "is_liked"):
            return bool(obj.is_liked)  # type: ignore[attr-defined]
        return obj.reactions.filter(user=request.user, reaction_type="like").exists()  # type: ignore[attr-defined]

    def get_is_favorited(self, obj: ForumPost) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, "is_favorited"):
            return bool(getattr(obj, "is_favorited"))
        return obj.post_favorites.filter(user=request.user).exists()  # type: ignore[attr-defined]


class ForumPostCreateSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(
        child=serializers.CharField(max_length=24),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = ForumPost
        fields = ["title", "category", "content", "tags"]

    def to_internal_value(self, data):
        data = data.copy()
        tags = data.get("tags", [])
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = [
                    tag.strip()
                    for tag in tags.split(",")
                    if isinstance(tag, str) and tag.strip()
                ]
        if isinstance(tags, tuple):
            tags = list(tags)
        data["tags"] = tags
        return super().to_internal_value(data)

    def validate_tags(self, value):
        cleaned = [tag.strip() for tag in value if tag.strip()]
        return cleaned[:10]

    def create(self, validated_data):
        request = self.context["request"]
        post = ForumPost.objects.create(author=request.user, **validated_data)
        return post


class ForumCommentCreateSerializer(serializers.ModelSerializer):
    # 允许内容为空（当包含图片时），并使其为可选字段
    content = serializers.CharField(allow_blank=True, required=False)
    class Meta:
        model = ForumComment
        fields = ["content", "parent"]

    def validate_parent(self, value):
        if value is None:
            return value
        post: ForumPost = self.context["post"]
        if value.post_id != post.id:  # type: ignore[attr-defined]
            raise serializers.ValidationError("父评论不属于当前帖子")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        post: ForumPost = self.context["post"]
        # 处理文件上传
        files = request.FILES.getlist("images") if hasattr(request, "FILES") else []

        # 业务校验：当没有文本内容时，必须至少有一张图片
        content_val = (validated_data.get("content") or "").strip()
        if not content_val and len(files) == 0:
            raise serializers.ValidationError("评论内容为空时，至少需要上传一张图片")

        comment = ForumComment.objects.create(
            post=post,
            author=request.user,
            **validated_data,
        )

        for f in files:
            ForumCommentImage.objects.create(comment=comment, image=f)
        return comment


# 最小化的 Reaction 序列化器，供视图层在不同分支合并时回退使用
class PostReactionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    post = serializers.IntegerField()
    user = serializers.IntegerField()
    reaction_type = serializers.CharField(max_length=32)


class CommentReactionSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    comment = serializers.IntegerField()
    user = serializers.IntegerField()
    reaction_type = serializers.CharField(max_length=32)
