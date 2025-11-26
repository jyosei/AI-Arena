from django.conf import settings
from django.db import models


class ForumPost(models.Model):
    CATEGORY_CHOICES = (
        ("技术交流", "技术交流"),
        ("功能建议", "功能建议"),
        ("作品分享", "作品分享"),
        ("问题反馈", "问题反馈"),
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_posts",
    )
    title = models.CharField(max_length=200)
    content = models.TextField()
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES)
    tags = models.JSONField(default=list, blank=True)
    is_sticky = models.BooleanField(default=False)
    views = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_sticky", "-created_at"]

    def __str__(self) -> str:
        return self.title


class ForumPostImage(models.Model):
    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="forum/posts/%Y/%m/%d/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Image for post {getattr(self, 'post_id', None)}"


class ForumPostLike(models.Model):
    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="post_likes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_post_likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user")

    def __str__(self) -> str:
        return f"PostLike user={getattr(self, 'user_id', None)} post={getattr(self, 'post_id', None)}"


class ForumComment(models.Model):
    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_comments",
    )
    content = models.TextField()
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"Comment {self.pk} on post {getattr(self, 'post_id', None)}"


class ForumCommentLike(models.Model):
    comment = models.ForeignKey(
        ForumComment,
        on_delete=models.CASCADE,
        related_name="comment_likes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_comment_likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("comment", "user")

    def __str__(self) -> str:
        return f"CommentLike user={getattr(self, 'user_id', None)} comment={getattr(self, 'comment_id', None)}"


class ForumCommentImage(models.Model):
    """单条评论图片附件。"""
    comment = models.ForeignKey(
        ForumComment,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="forum/comments/%Y/%m/%d/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:
        return f"CommentImage {self.pk} for comment {getattr(self, 'comment_id', None)}"


class ForumPostFavorite(models.Model):
    """帖子收藏关系 (用户 -> 帖子)。唯一约束避免重复收藏。"""
    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="post_favorites",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_post_favorites",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user")
        indexes = [
            models.Index(fields=["user", "post"]),
        ]

    def __str__(self) -> str:
        return f"PostFavorite user={getattr(self, 'user_id', None)} post={getattr(self, 'post_id', None)}"


class ForumPostViewHistory(models.Model):
    """帖子浏览历史。记录用户最近一次查看时间与总次数。"""
    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="view_histories",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_post_view_histories",
    )
    view_count = models.PositiveIntegerField(default=1)
    last_viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("post", "user")
        indexes = [
            models.Index(fields=["user", "last_viewed_at"]),
        ]

    def __str__(self) -> str:
        return f"PostViewHistory user={getattr(self, 'user_id', None)} post={getattr(self, 'post_id', None)} count={self.view_count}"
