from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from uuid import uuid4


def forum_attachment_upload_to(instance, filename):
    extension = (filename.rsplit('.', 1)[-1] if '.' in filename else 'bin').lower()
    uploader_segment = str(getattr(instance, 'uploader_id', 'anonymous'))
    return f"forum/{uploader_segment}/{uuid4().hex}.{extension}"


# 兼容旧版的简单分类选项，保留以便迁移或向后兼容
CATEGORY_CHOICES = (
    ("技术交流", "技术交流"),
    ("功能建议", "功能建议"),
    ("作品分享", "作品分享"),
    ("问题反馈", "问题反馈"),
)


class ForumCategory(models.Model):
    """论坛板块分类（更结构化）。"""

    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sort_order", "name")
        verbose_name = "论坛板块"
        verbose_name_plural = "论坛板块"

    def __str__(self) -> str:
        return self.name


class ForumTag(models.Model):
    """帖子标签。"""

    name = models.CharField(max_length=32, unique=True)
    slug = models.SlugField(max_length=32, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "帖子标签"
        verbose_name_plural = "帖子标签"

    def __str__(self) -> str:
        return self.name


class ForumPost(models.Model):
    """论坛帖子，兼容老结构（string category / json tags）和新结构（分类表 / 标签表）。"""

    class PostStatus(models.TextChoices):
        DRAFT = "draft", "草稿"
        PUBLISHED = "published", "已发布"
        ARCHIVED = "archived", "已归档"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_posts",
    )

    # 新的结构化分类引用（可为空，以兼容旧数据）
    category_obj = models.ForeignKey(
        ForumCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="posts",
    )

    # 兼容旧版的字符串分类字段
    legacy_category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, null=True, blank=True)

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    content = models.TextField()
    status = models.CharField(
        max_length=12,
        choices=PostStatus.choices,
        default=PostStatus.PUBLISHED,
    )
    is_sticky = models.BooleanField(default=False)
    allow_comments = models.BooleanField(default=True)

    # 新统计字段
    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)
    favorite_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    last_activity_at = models.DateTimeField(default=timezone.now)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 新的标签关联
    tags = models.ManyToManyField(ForumTag, related_name="posts", blank=True)

    # 兼容旧版的 tags JSON 存储
    legacy_tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("-is_sticky", "-last_activity_at", "-created_at")
        verbose_name = "帖子"
        verbose_name_plural = "帖子"

    def __str__(self) -> str:
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title)[:50] or uuid4().hex[:8]
            slug_candidate = base_slug
            index = 1
            while ForumPost.objects.filter(slug=slug_candidate).exclude(pk=self.pk).exists():
                slug_candidate = f"{base_slug}-{index}"
                index += 1
            self.slug = slug_candidate
        if not self.last_activity_at:
            self.last_activity_at = timezone.now()
        super().save(*args, **kwargs)


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


class ForumAttachment(models.Model):
    """帖子或评论的图片附件（更通用）。"""

    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_attachments",
    )
    file = models.ImageField(upload_to=forum_attachment_upload_to)
    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="attachments",
        null=True,
        blank=True,
    )
    comment = models.ForeignKey(
        "ForumComment",
        on_delete=models.CASCADE,
        related_name="attachments",
        null=True,
        blank=True,
    )
    content_type = models.CharField(max_length=64, blank=True)
    size = models.PositiveIntegerField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "附件"
        verbose_name_plural = "附件"

    def __str__(self) -> str:
        target = self.post or self.comment
        return f"Attachment {self.pk or 'new'} for {target or 'pending'}"

    def clean(self):
        if self.post_id and self.comment_id:
            raise ValueError("附件不能同时关联帖子和评论。")

    def save(self, *args, **kwargs):
        self.clean()
        if self.file:
            self.size = getattr(self.file, "size", 0)
            content_type = getattr(getattr(self.file, "file", None), "content_type", "")
            if content_type:
                self.content_type = content_type
            try:
                self.file.open()
                from PIL import Image

                with Image.open(self.file) as img:
                    self.width, self.height = img.size
            except Exception:
                # 如果无法解析图片尺寸则保持默认值
                pass
            finally:
                try:
                    self.file.seek(0)
                except Exception:
                    pass
        super().save(*args, **kwargs)


class ForumPostReaction(models.Model):
    """帖子互动行为：点赞、收藏等（更通用）。"""

    class ReactionType(models.TextChoices):
        LIKE = "like", "点赞"
        FAVORITE = "favorite", "收藏"

    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="post_reactions",
    )
    reaction_type = models.CharField(max_length=16, choices=ReactionType.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("post", "user", "reaction_type")
        verbose_name = "帖子互动"
        verbose_name_plural = "帖子互动"

    def __str__(self) -> str:
        return f"{self.user} {self.reaction_type} {self.post}"


class ForumComment(models.Model):
    """帖子评论（包含楼中楼回复），合并两边设计。"""

    MAX_DEPTH = 5

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
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    content = models.TextField()
    depth = models.PositiveIntegerField(default=0)
    is_deleted = models.BooleanField(default=False)
    like_count = models.PositiveIntegerField(default=0)
    favorite_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)
        verbose_name = "评论"
        verbose_name_plural = "评论"

    def __str__(self) -> str:
        return f"Comment by {self.author} on {self.post}"

    def save(self, *args, **kwargs):
        if self.parent and not self.post_id:
            self.post = self.parent.post
        if self.parent:
            self.depth = self.parent.depth + 1
        else:
            self.depth = 0
        if self.depth > self.MAX_DEPTH:
            raise ValueError("评论层级过深，请减少回复嵌套。")
        super().save(*args, **kwargs)


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


class ForumCommentReaction(models.Model):
    """评论互动行为（更通用）。"""

    class ReactionType(models.TextChoices):
        LIKE = "like", "点赞"
        FAVORITE = "favorite", "收藏"

    comment = models.ForeignKey(
        ForumComment,
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comment_reactions",
    )
    reaction_type = models.CharField(max_length=16, choices=ReactionType.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("comment", "user", "reaction_type")
        verbose_name = "评论互动"
        verbose_name_plural = "评论互动"

    def __str__(self) -> str:
        return f"{self.user} {self.reaction_type} {self.comment}"


class ForumCommentImage(models.Model):
    """单条评论图片附件（兼容旧实现）。"""
    comment = models.ForeignKey(
        ForumComment,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="forum/comments/%Y/%m/%d/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-uploaded_at",)

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
        return (
            f"PostViewHistory user={getattr(self, 'user_id', None)} "
            f"post={getattr(self, 'post_id', None)} count={self.view_count}"
        )


class ForumPostShare(models.Model):
    """帖子分享记录，用于跟踪互关好友之间的分享行为。"""

    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="shares",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_post_shares",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_post_shares",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["sender", "created_at"]),
            models.Index(fields=["receiver", "created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover - 简单表示
        return (
            f"ForumPostShare post={getattr(self, 'post_id', None)} "
            f"sender={getattr(self, 'sender_id', None)} receiver={getattr(self, 'receiver_id', None)}"
        )


# 信号：自动更新帖子统计
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


@receiver(post_save, sender=ForumComment)
def update_post_comment_count_on_create(sender, instance, created, **kwargs):
    """评论创建或更新时更新帖子的评论数"""
    if instance.post:
        instance.post.comment_count = instance.post.comments.count()
        instance.post.last_activity_at = instance.created_at if created else instance.post.last_activity_at
        instance.post.save(update_fields=['comment_count', 'last_activity_at'])


@receiver(post_delete, sender=ForumComment)
def update_post_comment_count_on_delete(sender, instance, **kwargs):
    """评论删除时更新帖子的评论数"""
    if instance.post:
        instance.post.comment_count = instance.post.comments.count()
        instance.post.save(update_fields=['comment_count'])


@receiver(post_save, sender=ForumPostReaction)
def update_post_like_count_on_create(sender, instance, created, **kwargs):
    """点赞创建时更新帖子的点赞数"""
    if created and instance.reaction_type == 'like':
        instance.post.like_count = instance.post.reactions.filter(reaction_type='like').count()
        instance.post.save(update_fields=['like_count'])


@receiver(post_delete, sender=ForumPostReaction)
def update_post_like_count_on_delete(sender, instance, **kwargs):
    """点赞删除时更新帖子的点赞数"""
    if instance.reaction_type == 'like':
        instance.post.like_count = instance.post.reactions.filter(reaction_type='like').count()
        instance.post.save(update_fields=['like_count'])
