from django.contrib import admin

from . import models


@admin.register(models.ForumCategory)
class ForumCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "sort_order", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(models.ForumTag)
class ForumTagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(models.ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "author",
        "category",
        "status",
        "is_sticky",
        "view_count",
        "comment_count",
        "created_at",
    )
    list_filter = ("status", "is_sticky", "category")
    search_fields = ("title", "slug", "content")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("tags",)


@admin.register(models.ForumComment)
class ForumCommentAdmin(admin.ModelAdmin):
    list_display = (
        "post",
        "author",
        "parent",
        "depth",
        "like_count",
        "created_at",
    )
    list_filter = ("depth",)
    search_fields = ("content",)


@admin.register(models.ForumAttachment)
class ForumAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "uploader", "post", "comment", "size", "created_at")
    list_filter = ("created_at",)
    search_fields = ("post__title", "comment__content", "uploader__username")


@admin.register(models.ForumPostReaction)
class ForumPostReactionAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "reaction_type", "created_at")
    list_filter = ("reaction_type",)
    search_fields = ("post__title", "user__username")


@admin.register(models.ForumCommentReaction)
class ForumCommentReactionAdmin(admin.ModelAdmin):
    list_display = ("comment", "user", "reaction_type", "created_at")
    list_filter = ("reaction_type",)
    search_fields = ("comment__content", "user__username")


@admin.register(models.ForumShareLog)
class ForumShareLogAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "channel", "created_at")
    list_filter = ("channel",)
    search_fields = ("post__title", "user__username")
