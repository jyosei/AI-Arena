from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission
from django.utils.translation import gettext_lazy as _
from django.utils import timezone


class User(AbstractUser):
    description = models.TextField(blank=True)
    avatar = models.URLField(blank=True, help_text="外部头像URL（优先使用该字段）")
    avatar_file = models.ImageField(
        upload_to="users/avatars/%Y/%m/%d/",
        blank=True,
        null=True,
        help_text="上传头像文件",
    )

    # 兼容自定义 related_name，避免与默认 User 冲突（来自迁移 0002）
    groups = models.ManyToManyField(
        Group,
        verbose_name=_('groups'),
        blank=True,
        help_text=_(
            'The groups this user belongs to. A user will get all permissions '
            'granted to each of their groups.'
        ),
        related_name="custom_user_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name=_('user permissions'),
        blank=True,
        help_text=_('Specific permissions for this user.'),
        related_name="custom_user_permissions_set",
        related_query_name="user",
    )

    def __str__(self):
        return self.username

    @property
    def avatar_url(self) -> str:
        """统一返回头像地址。如果填写了外链 avatar 优先；否则返回上传文件 URL。"""
        if self.avatar:
            return self.avatar
        try:
            if self.avatar_file and hasattr(self.avatar_file, "url"):
                return self.avatar_file.url  # type: ignore[attr-defined]
        except Exception:
            return ""
        return ""


class Notification(models.Model):
    ACTION_CHOICES = (
        ("post_like", "帖子被点赞"),
        ("post_comment", "帖子收到评论"),
        ("comment_reply", "评论被回复"),
        ("comment_like", "评论被点赞"),
    )

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="actions",
    )
    action_type = models.CharField(max_length=32, choices=ACTION_CHOICES)
    post = models.ForeignKey(
        "forum.ForumPost",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    comment = models.ForeignKey(
        "forum.ForumComment",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["action_type"]),
        ]

    def __str__(self) -> str:  # pragma: no cover - 简单表示
        return f"Notification {self.pk} to {getattr(self, 'recipient_id', None)}"

    @property
    def message(self) -> str:
        actor_name = getattr(self.actor, "username", "用户")
        if self.action_type == "post_like" and self.post:
            return f"{actor_name} 点赞了你的帖子《{self.post.title}》"
        if self.action_type == "post_comment" and self.post:
            return f"{actor_name} 评论了你的帖子《{self.post.title}》"
        if self.action_type == "comment_reply" and self.comment:
            return f"{actor_name} 回复了你的评论"
        if self.action_type == "comment_like" and self.comment:
            return f"{actor_name} 点赞了你的评论"
        return "收到新通知"

    @classmethod
    def create(
        cls,
        *,
        recipient: User,
        actor: User,
        action_type: str,
        post=None,
        comment=None,
    ) -> "Notification":
        """统一创建通知，避免重复逻辑。失败不抛出致命异常。"""
        try:
            return cls.objects.create(
                recipient=recipient,
                actor=actor,
                action_type=action_type,
                post=post,
                comment=comment,
            )
        except Exception:
            # 记录失败但不中断主流程（可扩展为 logging）
            return cls()  # 返回空对象以兼容调用方
