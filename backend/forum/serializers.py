from typing import Iterable, List
from uuid import uuid4

from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify
from rest_framework import serializers

from users.models import User

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


class ForumAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "avatar", "description")


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

    class Meta:
        model = ForumAttachment
        fields = ("id", "url", "width", "height", "content_type", "size", "created_at")
        read_only_fields = fields

    def get_url(self, instance):
        if not instance.file:
            return ""
        request = self.context.get("request")
        url = instance.file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class ForumPostBaseSerializer(serializers.ModelSerializer):
    author = ForumAuthorSerializer(read_only=True)
    category = ForumCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=ForumCategory.objects.filter(is_active=True),
        allow_null=True,
        required=False,
        source="category",
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=32),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    attachments = ForumAttachmentSerializer(many=True, read_only=True)
    attachment_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    user_reactions = serializers.SerializerMethodField()

    class Meta:
        model = ForumPost
        fields = (
            "id",
            "title",
            "slug",
            "author",
            "category",
            "category_id",
            "tags",
            "status",
            "is_sticky",
            "allow_comments",
            "view_count",
            "like_count",
            "favorite_count",
            "share_count",
            "comment_count",
            "last_activity_at",
            "created_at",
            "updated_at",
            "attachments",
            "attachment_ids",
            "user_reactions",
        )
        read_only_fields = (
            "slug",
            "view_count",
            "like_count",
            "favorite_count",
            "share_count",
            "comment_count",
            "last_activity_at",
            "created_at",
            "updated_at",
            "attachments",
            "user_reactions",
        )

    def to_representation(self, instance):
        # attach tags as plain list of names
        rep = super().to_representation(instance)
        rep["tags"] = list(instance.tags.order_by("name").values_list("name", flat=True))
        return rep

    def get_user_reactions(self, instance):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return {"like": False, "favorite": False}
        user = request.user
        reactions = instance.reactions.filter(user=user)
        return {
            "like": reactions.filter(reaction_type=ForumPostReaction.ReactionType.LIKE).exists(),
            "favorite": reactions.filter(
                reaction_type=ForumPostReaction.ReactionType.FAVORITE
            ).exists(),
        }

    def _sync_tags(self, instance: ForumPost, tag_names: Iterable[str]):
        if tag_names is None:
            return
        normalized: List[ForumTag] = []
        for name in tag_names:
            clean_name = name.strip()
            if not clean_name:
                continue
            slug = slugify(clean_name)[:32] or slugify(uuid4().hex[:8])
            existing = ForumTag.objects.filter(
                Q(name__iexact=clean_name) | Q(slug__iexact=slug)
            ).first()
            if existing:
                tag = existing
                if tag.name != clean_name:
                    tag.name = clean_name
                    tag.save(update_fields=["name"])
            else:
                base_slug = slug or uuid4().hex[:8]
                unique_slug = base_slug
                counter = 1
                while ForumTag.objects.filter(slug=unique_slug).exists():
                    unique_slug = f"{base_slug}-{counter}"[:32]
                    counter += 1
                tag = ForumTag.objects.create(name=clean_name, slug=unique_slug)
            normalized.append(tag)
        instance.tags.set(normalized)

    def _attach_files(self, instance: ForumPost, attachment_ids: Iterable[int]):
        if attachment_ids is None:
            return
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError({"attachment_ids": "请先登录后再上传附件。"})
        unique_ids = list(dict.fromkeys(attachment_ids))
        if not unique_ids:
            if instance.pk:
                instance.attachments.update(post=None)
            return
        attachments = ForumAttachment.objects.filter(id__in=unique_ids, uploader=request.user)
        found_ids = set(attachments.values_list("id", flat=True))
        missing = [value for value in unique_ids if value not in found_ids]
        if missing:
            raise serializers.ValidationError({"attachment_ids": "部分附件不存在或无权访问。"})
        occupied = attachments.exclude(post=instance).filter(
            Q(post__isnull=False) | Q(comment__isnull=False)
        )
        if occupied.exists():
            raise serializers.ValidationError({"attachment_ids": "部分附件已经被其他内容使用。"})
        current_ids = set(instance.attachments.values_list("id", flat=True))
        to_detach = current_ids - set(unique_ids)
        if to_detach:
            ForumAttachment.objects.filter(id__in=to_detach).update(post=None)
        attachments.update(post=instance, comment=None)

    @transaction.atomic
    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        attachment_ids = validated_data.pop("attachment_ids", [])
        post = ForumPost.objects.create(**validated_data)
        self._sync_tags(post, tags)
        self._attach_files(post, attachment_ids)
        return post

    @transaction.atomic
    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        attachment_ids = validated_data.pop("attachment_ids", None)
        post = super().update(instance, validated_data)
        if tags is not None:
            self._sync_tags(post, tags)
        if attachment_ids is not None:
            self._attach_files(post, attachment_ids)
        return post


class ForumPostListSerializer(ForumPostBaseSerializer):
    excerpt = serializers.SerializerMethodField()

    class Meta(ForumPostBaseSerializer.Meta):
        fields = ForumPostBaseSerializer.Meta.fields + ("excerpt",)

    def get_excerpt(self, instance: ForumPost) -> str:
        return instance.content[:200]


class ForumPostDetailSerializer(ForumPostBaseSerializer):
    class Meta(ForumPostBaseSerializer.Meta):
        fields = ForumPostBaseSerializer.Meta.fields + ("content",)


class ForumCommentSerializer(serializers.ModelSerializer):
    author = ForumAuthorSerializer(read_only=True)
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=ForumComment.objects.all(),
        source="parent",
        allow_null=True,
        required=False,
        write_only=True,
    )
    parent = serializers.IntegerField(source="parent_id", read_only=True)
    children = serializers.SerializerMethodField()
    user_reactions = serializers.SerializerMethodField()
    is_author = serializers.SerializerMethodField()
    attachments = ForumAttachmentSerializer(many=True, read_only=True)
    attachment_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = ForumComment
        fields = (
            "id",
            "post",
            "author",
            "parent_id",
            "parent",
            "content",
            "depth",
            "is_deleted",
            "like_count",
            "favorite_count",
            "share_count",
            "created_at",
            "updated_at",
            "children",
            "user_reactions",
            "is_author",
            "attachments",
            "attachment_ids",
        )
        read_only_fields = (
            "post",
            "depth",
            "is_deleted",
            "like_count",
            "favorite_count",
            "share_count",
            "created_at",
            "updated_at",
            "children",
            "user_reactions",
            "is_author",
            "parent",
            "attachments",
        )

    def get_children(self, instance):
        request = self.context.get("request")
        serializer = ForumCommentSerializer(
            instance.children.order_by("created_at"), many=True, context={"request": request}
        )
        return serializer.data

    def get_user_reactions(self, instance):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return {"like": False, "favorite": False}
        reactions = instance.reactions.filter(user=request.user)
        return {
            "like": reactions.filter(
                reaction_type=ForumCommentReaction.ReactionType.LIKE
            ).exists(),
            "favorite": reactions.filter(
                reaction_type=ForumCommentReaction.ReactionType.FAVORITE
            ).exists(),
        }

    def get_is_author(self, instance):
        return instance.author_id == instance.post.author_id

    def _attach_files(self, instance: ForumComment, attachment_ids):
        if attachment_ids is None:
            return
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError({"attachment_ids": "请先登录后再上传附件。"})
        unique_ids = list(dict.fromkeys(attachment_ids))
        if not unique_ids:
            if instance.pk:
                instance.attachments.update(comment=None)
            return
        attachments = ForumAttachment.objects.filter(id__in=unique_ids, uploader=request.user)
        found_ids = set(attachments.values_list("id", flat=True))
        missing = [value for value in unique_ids if value not in found_ids]
        if missing:
            raise serializers.ValidationError({"attachment_ids": "部分附件不存在或无权访问。"})
        occupied = attachments.exclude(comment=instance).filter(
            Q(post__isnull=False) | Q(comment__isnull=False)
        )
        if occupied.exists():
            raise serializers.ValidationError({"attachment_ids": "部分附件已经被其他内容使用。"})
        current_ids = set(instance.attachments.values_list("id", flat=True))
        to_detach = current_ids - set(unique_ids)
        if to_detach:
            ForumAttachment.objects.filter(id__in=to_detach).update(comment=None)
        attachments.update(comment=instance, post=None)

    @transaction.atomic
    def create(self, validated_data):
        attachment_ids = validated_data.pop("attachment_ids", [])
        comment = super().create(validated_data)
        self._attach_files(comment, attachment_ids)
        return comment

    @transaction.atomic
    def update(self, instance, validated_data):
        attachment_ids = validated_data.pop("attachment_ids", None)
        comment = super().update(instance, validated_data)
        if attachment_ids is not None:
            self._attach_files(comment, attachment_ids)
        return comment


class ForumShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForumShareLog
        fields = ("id", "post", "user", "channel", "created_at")
        read_only_fields = ("id", "post", "user", "created_at")


class PostReactionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ForumPostReaction.ReactionType.choices)
    action = serializers.ChoiceField(choices=(("toggle", "toggle"), ("add", "add"), ("remove", "remove")), default="toggle")


class CommentReactionSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ForumCommentReaction.ReactionType.choices)
    action = serializers.ChoiceField(choices=(("toggle", "toggle"), ("add", "add"), ("remove", "remove")), default="toggle")
