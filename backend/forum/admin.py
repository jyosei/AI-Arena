from django.contrib import admin
from .models import (
    ForumCategory,
    ForumTag,
    ForumPost,
    ForumPostImage,
    ForumAttachment,
    ForumComment,
    ForumCommentLike,
    ForumPostReaction,
    ForumCommentReaction,
)


# ----------------- 分类和标签 -----------------
@admin.register(ForumCategory)
class ForumCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "sort_order", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ForumTag)
class ForumTagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


# ----------------- 帖子 -----------------
@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "author",
        "category_obj",
        "status",
        "is_sticky",
        "view_count",
        "comment_count",
        "created_at",
    )
    list_filter = ("status", "is_sticky", "category_obj", "created_at")
    search_fields = ("title", "slug", "content")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("tags",)


# ----------------- 评论 -----------------
@admin.register(ForumComment)
class ForumCommentAdmin(admin.ModelAdmin):
    list_display = (
        "post",
        "author",
        "parent",
        "depth",
        "like_count",
        "created_at",
    )
    list_filter = ("depth", "created_at")
    search_fields = ("content",)


# ----------------- 附件、图片、互动 -----------------
@admin.register(ForumAttachment)
class ForumAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "uploader", "post", "comment", "size", "created_at")
    list_filter = ("created_at",)
    search_fields = ("post__title", "comment__content", "uploader__username")


@admin.register(ForumPostImage)
class ForumPostImageAdmin(admin.ModelAdmin):
    list_display = ("post", "uploaded_at")
    list_filter = ("uploaded_at",)


@admin.register(ForumCommentLike)
class ForumCommentLikeAdmin(admin.ModelAdmin):
    list_display = ("comment", "user", "created_at")
    list_filter = ("created_at",)


@admin.register(ForumPostReaction)
class ForumPostReactionAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "reaction_type", "created_at")
    list_filter = ("reaction_type",)
    search_fields = ("post__title", "user__username")


@admin.register(ForumCommentReaction)
class ForumCommentReactionAdmin(admin.ModelAdmin):
    list_display = ("comment", "user", "reaction_type", "created_at")
    list_filter = ("reaction_type",)
    search_fields = ("comment__content", "user__username")
    search_fields = ("comment__content", "user__username")
