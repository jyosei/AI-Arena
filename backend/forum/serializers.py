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
    # 直接返回相对路径，让前端通过nginx代理加载媒体文件
    # 这样可以避免端口号丢失的问题
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
        url = getattr(instance.file, "url", "")
        # 返回相对路径，让前端通过nginx代理加载
        return build_media_url(None, url)


class ForumPostImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()  # 覆盖默认的ImageField
    image_url = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()  # 兼容前端

    class Meta:
        model = ForumPostImage
        fields = ["id", "image", "image_url", "url", "uploaded_at"]
        read_only_fields = fields

    def get_image(self, obj: ForumPostImage) -> str:
        """返回相对路径"""
        return build_media_url(None, getattr(obj.image, "url", ""))

    def get_image_url(self, obj: ForumPostImage) -> str:
        return build_media_url(None, getattr(obj.image, "url", ""))
    
    def get_url(self, obj: ForumPostImage) -> str:
        """兼容前端,返回image字段"""
        return build_media_url(None, getattr(obj.image, "url", ""))


class ForumCommentSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()  # 兼容前端，来自 ForumAttachment
    children = serializers.SerializerMethodField()  # 递归返回子评论
    is_author = serializers.SerializerMethodField()  # 是否是楼主
    user_reactions = serializers.SerializerMethodField()  # 用户反应状态
    like_count = serializers.SerializerMethodField()  # 兼容前端单数命名

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
            "like_count",
            "is_liked",
            "is_author",
            "user_reactions",
            "images",
            "attachments",
            "children",
        ]
        read_only_fields = [
            "id",
            "post",
            "author",
            "created_at",
            "updated_at",
            "likes_count",
            "like_count",
            "is_liked",
            "is_author",
            "user_reactions",
        ]

    def get_children(self, obj: ForumComment):
        """递归序列化子评论，使用预取的数据"""
        # 使用预取的children数据，而不是调用.all()重新查询
        if hasattr(obj, '_prefetched_objects_cache') and 'children' in obj._prefetched_objects_cache:
            children = obj._prefetched_objects_cache['children']
        elif hasattr(obj, 'children'):
            children = obj.children.all()
        else:
            return []
        
        return ForumCommentSerializer(children, many=True, context=self.context).data

    def get_is_author(self, obj: ForumComment) -> bool:
        """判断评论者是否是帖子作者"""
        return obj.author_id == obj.post.author_id if obj.post else False

    def get_user_reactions(self, obj: ForumComment) -> dict:
        """获取用户对评论的反应状态"""
        request = self.context.get("request")
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return {"like": False, "favorite": False}
        
        user = request.user
        is_liked = False
        
        if hasattr(obj, "comment_likes"):
            is_liked = obj.comment_likes.filter(user=user).exists()
        elif hasattr(obj, "reactions"):
            is_liked = obj.reactions.filter(user=user, reaction_type="like").exists()
        
        return {"like": is_liked, "favorite": False}

    def get_like_count(self, obj: ForumComment) -> int:
        """兼容前端单数命名"""
        return self.get_likes_count(obj)

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

    def get_attachments(self, obj: ForumComment):
        """返回附件列表，来自 ForumAttachment；若无则兼容旧 images。"""
        from .serializers import ForumAttachmentSerializer as _AttachSer
        request = self.context.get("request")
        try:
            attach_qs = getattr(obj, "attachments", None)
            if attach_qs is not None:
                data = _AttachSer(attach_qs.all(), many=True, context={"request": request}).data
                if data:
                    return data
        except Exception:
            pass
        return self.get_images(obj)

    def get_images(self, obj: ForumComment):
        request = self.context.get("request")
        output = []
        for img in getattr(obj, "images", []).all():  # type: ignore
            url = build_media_url(request, getattr(img.image, "url", ""))
            output.append({
                "id": img.pk,
                "image": url,
                "image_url": url,
                "url": url,  # 兼容前端
                "uploaded_at": img.uploaded_at,
            })
        return output


class ForumPostListSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    tags = ForumTagSerializer(many=True, read_only=True)
    category_obj = ForumCategorySerializer(read_only=True)
    category = serializers.SerializerMethodField()
    comments_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.SerializerMethodField()  # 兼容前端单数命名
    likes_count = serializers.IntegerField(read_only=True)
    like_count = serializers.SerializerMethodField()  # 兼容前端单数命名
    last_activity_at = serializers.DateTimeField(read_only=True)  # 从模型字段读取
    excerpt = serializers.SerializerMethodField()
    favorites_count = serializers.IntegerField(read_only=True)
    is_favorited = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()  # 列表页小图预览
    share_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "tags",
            "is_sticky",
            "view_count",
            "created_at",
            "updated_at",
            "last_activity_at",
            "comments_count",
            "comment_count",  # 兼容
            "likes_count",
            "like_count",  # 兼容
            "favorites_count",
            "share_count",
            "author",
            "excerpt",
            "is_favorited",
            "thumbnail",
            "category_obj",
            "category",
        ]
        read_only_fields = fields

    def get_comment_count(self, obj):
        """返回模型的 comment_count 字段值"""
        return obj.comment_count

    def get_like_count(self, obj):
        """返回模型的 like_count 字段值"""
        return obj.like_count

    def get_category(self, obj):
        if getattr(obj, "category_obj_id", None) is not None:
            return obj.category_obj_id
        legacy = getattr(obj, "legacy_category", None)
        return legacy

    def get_excerpt(self, obj: ForumPost) -> str:
        return Truncator(obj.content).words(50, truncate="...")

    def get_is_favorited(self, obj: ForumPost) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, "is_favorited"):
            return bool(getattr(obj, "is_favorited"))
        return obj.post_favorites.filter(user=request.user).exists()  # type: ignore[attr-defined]

    def get_thumbnail(self, obj: ForumPost) -> str:
        """返回帖子的小图预览：优先附件，其次旧的 images，最后从内容中提取第一张图片。"""
        # 1) ForumAttachment 优先
        try:
            attach_qs = getattr(obj, "attachments", None)
            if attach_qs is not None:
                first = attach_qs.all()[:1]
                if first:
                    return build_media_url(None, getattr(first[0].file, "url", ""))
        except Exception:
            pass
        # 2) 旧的 PostImage 回退
        try:
            images_qs = getattr(obj, "images", None)
            if images_qs is not None:
                first = images_qs.all()[:1]
                if first:
                    return build_media_url(None, getattr(first[0].image, "url", ""))
        except Exception:
            pass
        # 3) 从内容中解析第一张图片（支持 markdown 与 html）
        content = getattr(obj, "content", "") or ""
        if content:
            # markdown: ![alt](url)
            import re
            md = re.search(r"!\[[^\]]*\]\(([^)\s]+)\)", content)
            if md:
                return build_media_url(None, md.group(1))
            # html: <img src="...">
            html = re.search(r"<img[^>]+src=\"([^\"]+)\"", content)
            if html:
                return build_media_url(None, html.group(1))
        return ""


class ForumPostDetailSerializer(serializers.ModelSerializer):
    author = UserSummarySerializer(read_only=True)
    tags = ForumTagSerializer(many=True, read_only=True)
    category_obj = ForumCategorySerializer(read_only=True)
    category = serializers.SerializerMethodField()
    images = ForumPostImageSerializer(many=True, read_only=True)
    attachments = serializers.SerializerMethodField()  # 兼容前端，返回附件（优先 ForumAttachment）
    comments = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True)
    like_count = serializers.SerializerMethodField()  # 兼容前端
    comments_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.SerializerMethodField()  # 兼容前端
    is_liked = serializers.SerializerMethodField()
    favorites_count = serializers.IntegerField(read_only=True)
    is_favorited = serializers.SerializerMethodField()
    share_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ForumPost
        fields = [
            "id",
            "title",
            "tags",
            "content",
            "is_sticky",
            "view_count",
            "created_at",
            "updated_at",
            "author",
            "images",
            "attachments",  # 兼容
            "comments",
            "likes_count",
            "like_count",  # 兼容
            "comments_count",
            "comment_count",  # 兼容
            "is_liked",
            "share_count",
            "favorites_count",
            "is_favorited",
            "category_obj",
            "category",
        ]
        read_only_fields = fields

    def get_attachments(self, obj):
        """返回附件列表，优先使用 ForumAttachment，其次兼容旧的 images。"""
        from .serializers import ForumAttachmentSerializer as _AttachSer
        request = self.context.get("request")
        try:
            attach_qs = getattr(obj, "attachments", None)
            if attach_qs is not None:
                data = _AttachSer(attach_qs.all(), many=True, context={"request": request}).data
                if data:
                    return data
        except Exception:
            pass
        # 退回到旧的 images
        return ForumPostImageSerializer(obj.images.all(), many=True, context=self.context).data

    def get_comment_count(self, obj):
        """返回模型的 comment_count 字段值"""
        return obj.comment_count

    def get_like_count(self, obj):
        """返回模型的 like_count 字段值"""
        return obj.like_count

    def get_category(self, obj):
        if getattr(obj, "category_obj_id", None) is not None:
            return obj.category_obj_id
        legacy = getattr(obj, "legacy_category", None)
        return legacy

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
    category = serializers.IntegerField(source='category_obj_id', required=False, allow_null=True)
    attachment_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = ForumPost
        fields = ["title", "category", "content", "tags", "attachment_ids"]

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
        tags_data = validated_data.pop('tags', [])
        attachment_ids = validated_data.pop('attachment_ids', [])
        # author 由 perform_create 传入,不在这里设置
        post = ForumPost.objects.create(**validated_data)
        
        # 处理标签
        if tags_data:
            from forum.models import ForumTag
            from django.utils.text import slugify
            for tag_name in tags_data:
                tag, _ = ForumTag.objects.get_or_create(
                    name=tag_name,
                    defaults={'slug': slugify(tag_name)}
                )
                post.tags.add(tag)
        
        # 处理预先上传的附件：直接关联到帖子（不再复制为 PostImage）
        if attachment_ids:
            from forum.models import ForumAttachment
            request = self.context.get('request')
            if request and request.user.is_authenticated:
                ForumAttachment.objects.filter(
                    id__in=attachment_ids,
                    uploader=request.user
                ).update(post=post)
        
        return post


class ForumCommentCreateSerializer(serializers.ModelSerializer):
    # 允许内容为空（当包含图片时），并使其为可选字段
    content = serializers.CharField(allow_blank=True, required=False)
    attachment_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    
    class Meta:
        model = ForumComment
        fields = ["content", "parent", "attachment_ids"]

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
        attachment_ids = validated_data.pop("attachment_ids", [])
        
        # 处理文件上传(兼容旧方式)
        files = request.FILES.getlist("images") if hasattr(request, "FILES") else []

        # 业务校验：当没有文本内容时，必须至少有一张图片或附件
        content_val = (validated_data.get("content") or "").strip()
        if not content_val and len(files) == 0 and len(attachment_ids) == 0:
            raise serializers.ValidationError("评论内容为空时，至少需要上传一张图片")

        comment = ForumComment.objects.create(
            post=post,
            author=request.user,
            **validated_data,
        )

        # 处理直接上传的文件（旧方式，仍然支持）
        for f in files:
            ForumCommentImage.objects.create(comment=comment, image=f)
        
        # 处理预先上传的附件：直接把附件关联到该评论
        if attachment_ids:
            from forum.models import ForumAttachment
            ForumAttachment.objects.filter(
                id__in=attachment_ids,
                uploader=request.user
            ).update(comment=comment)
        
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
