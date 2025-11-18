from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from uuid import uuid4


def forum_attachment_upload_to(instance, filename):
    extension = (filename.rsplit('.', 1)[-1] if '.' in filename else 'bin').lower()
    uploader_segment = str(instance.uploader_id or 'anonymous')
    return f"forum/{uploader_segment}/{uuid4().hex}.{extension}"


class ForumCategory(models.Model):
    """论坛板块分类。"""

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
    """论坛帖子。"""

    class PostStatus(models.TextChoices):
        DRAFT = "draft", "草稿"
        PUBLISHED = "published", "已发布"
        ARCHIVED = "archived", "已归档"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="forum_posts",
    )
    category = models.ForeignKey(
        ForumCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="posts",
    )
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
    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)
    favorite_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    last_activity_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    tags = models.ManyToManyField(ForumTag, related_name="posts", blank=True)

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


class ForumComment(models.Model):
    """帖子评论（包含楼中楼回复）。"""

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


class ForumAttachment(models.Model):
    """帖子或评论的图片附件。"""

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
    """帖子互动行为：点赞、收藏等。"""

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


class ForumCommentReaction(models.Model):
    """评论互动行为：点赞、收藏等。"""

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
        return f"{self.user} {self.reaction_type} comment {self.comment_id}"


class ForumShareLog(models.Model):
    """记录分享行为，用于统计。"""

    post = models.ForeignKey(
        ForumPost,
        on_delete=models.CASCADE,
        related_name="share_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="post_shares",
    )
    channel = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "分享记录"
        verbose_name_plural = "分享记录"

    def __str__(self) -> str:
        user_display = self.user.username if self.user else "anonymous"
        return f"{user_display} shared {self.post_id}"
