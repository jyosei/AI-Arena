from django.contrib import admin

from .models import ForumComment, ForumCommentLike, ForumPost, ForumPostImage, ForumPostLike


@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "author", "is_sticky", "views", "created_at")
    list_filter = ("category", "is_sticky", "created_at")
    search_fields = ("title", "content", "tags")
    ordering = ("-created_at",)


@admin.register(ForumPostImage)
class ForumPostImageAdmin(admin.ModelAdmin):
    list_display = ("post", "uploaded_at")
    list_filter = ("uploaded_at",)


@admin.register(ForumPostLike)
class ForumPostLikeAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "created_at")
    list_filter = ("created_at",)


@admin.register(ForumComment)
class ForumCommentAdmin(admin.ModelAdmin):
    list_display = ("post", "author", "created_at")
    search_fields = ("content",)
    list_filter = ("created_at",)


@admin.register(ForumCommentLike)
class ForumCommentLikeAdmin(admin.ModelAdmin):
    list_display = ("comment", "user", "created_at")
    list_filter = ("created_at",)
