import json
from typing import Any
from urllib.parse import urljoin

from django.conf import settings
from django.db.models import Count, Q
from django.utils.text import Truncator
from rest_framework import serializers

from .models import (
    ForumComment,
    ForumCommentLike,
    ForumPost,
    ForumPostImage,
    ForumPostLike,
    ForumCommentImage,
)


class UserSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(source="pk")
    username = serializers.CharField()
    avatar = serializers.CharField(allow_blank=True, allow_null=True, default="")

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        request = self.context.get("request")
        # 统一使用用户的 avatar_url 属性（包含外链或上传文件），并标准化为绝对地址
        avatar_raw = getattr(instance, "avatar_url", "") or getattr(instance, "avatar", "")
        rep["avatar"] = build_media_url(request, avatar_raw)
        return rep


def build_media_url(request, path) -> str:
    """构造稳定的绝对媒体文件 URL。

    解决以下潜在问题：
    1. 相对路径缺少前导斜杠导致前端拼接异常。
    2. path 不是以 MEDIA_URL 开头，直接 build_absolute_uri 可能出现重复 host 或错误的内部服务名。
    3. Docker 反向代理场景下，避免返回 backend:8000 这类浏览器无法直接访问的主机名。
    4. 允许通过 MEDIA_BASE_URL 强制覆盖域名（生产场景使用 CDN 或独立域名）。
    """
    if not path:
        return ""
    # 转成字符串，避免传入的是 Path/File 等对象
    path = str(path)
    if path.startswith(("http://", "https://")):
        return path

    # 标准化 path 前缀
    if not path.startswith("/"):
        path = f"/{path}"

    media_url = getattr(settings, "MEDIA_URL", "/media/") or "/media/"
    if not media_url.startswith("/"):
        media_url = f"/{media_url}"
    if not media_url.endswith("/"):
        media_url = f"{media_url}/"

    # 如果 path 不以 media_url 开头，尝试补齐（排除已经包含 /media/ 的情况）
    if not path.startswith(media_url) and "/media/" not in path.split("?")[0]:
        path = media_url + path.lstrip("/")

    base = getattr(settings, "MEDIA_BASE_URL", "") or ""
    if base:
        # MEDIA_BASE_URL 可能不以 / 结尾
        base = base.rstrip("/") + "/"
        return urljoin(base, path.lstrip("/"))

    if request:
        # 使用 request.get_host 避免内部主机名泄漏；协议由 is_secure 判断
        scheme = "https" if request.is_secure() else "http"
        host = request.get_host()
        return f"{scheme}://{host}{path}"

    # 无 request（极少数场景）返回原始 path（前端再补）
    return path


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
        # 统一保证两个字段都是绝对地址，前端仍可兼容旧字段
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
        return getattr(obj, "likes_count", None) or obj.comment_likes.count()  # type: ignore[attr-defined]

    def get_is_liked(self, obj: ForumComment) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, "is_liked"):
            return bool(obj.is_liked)  # type: ignore[attr-defined]
        return obj.comment_likes.filter(user=request.user).exists()  # type: ignore[attr-defined]

    def get_images(self, obj: ForumComment):
        request = self.context.get("request")
        output = []
        for img in getattr(obj, "images", []).all():  # type: ignore[attr-defined]
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
    likes_count = serializers.IntegerField(read_only=True)
    last_activity = serializers.DateTimeField(read_only=True)
    excerpt = serializers.SerializerMethodField()
    favorites_count = serializers.IntegerField(read_only=True)
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "category",
            "tags",
            "is_sticky",
            "views",
            "created_at",
            "updated_at",
            "last_activity",
            "comments_count",
            "likes_count",
            "favorites_count",
            "author",
            "excerpt",
            "is_favorited",
        ]
        read_only_fields = fields

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
    comments_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    favorites_count = serializers.IntegerField(read_only=True)
    is_favorited = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "category",
            "tags",
            "content",
            "is_sticky",
            "views",
            "created_at",
            "updated_at",
            "author",
            "images",
            "comments",
            "likes_count",
            "comments_count",
            "is_liked",
            "favorites_count",
            "is_favorited",
        ]
        read_only_fields = fields

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
        return obj.post_likes.filter(user=request.user).exists()  # type: ignore[attr-defined]

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
