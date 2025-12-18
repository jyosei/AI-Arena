from pathlib import Path

from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models
from django.db.models.functions import Now
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    description = models.TextField(blank=True)
    avatar = models.URLField(blank=True, help_text="外部头像URL(优先使用该字段)")
    avatar_file = models.ImageField(
        upload_to="users/avatars/%Y/%m/%d/",
        blank=True,
        null=True,
        help_text="上传头像文件",
    )
    
    # 微信登录字段
    wechat_openid = models.CharField(max_length=128, blank=True, unique=True, null=True, help_text="微信OpenID")
    wechat_unionid = models.CharField(max_length=128, blank=True, unique=True, null=True, help_text="微信UnionID")

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
        field = getattr(self, "avatar_file", None)
        if not field:
            return ""

        try:
            storage = field.storage
            name = field.name
            if name and storage.exists(name):
                return field.url  # type: ignore[attr-defined]

            alt_name = ""
            if name:
                path = Path(name)
                stem = path.stem
                if "_" in stem:
                    base, suffix = stem.rsplit("_", 1)
                    # 仅当后缀看起来像随机字符串时才尝试回退
                    if suffix.isalnum() and 4 <= len(suffix) <= 16:
                        alt_name = str(path.with_stem(base))
            if alt_name and storage.exists(alt_name):
                return storage.url(alt_name)
        except Exception:
            return ""
        return ""


class Notification(models.Model):
    ACTION_CHOICES = (
        ("post_like", "帖子被点赞"),
        ("post_comment", "帖子收到评论"),
        ("comment_reply", "评论被回复"),
        ("comment_like", "评论被点赞"),
        ("post_favorite", "帖子被收藏"),
        ("follow", "获得新关注"),
        ("mutual_follow", "互相关注"),
        ("post_share", "帖子被分享"),
        ("private_message", "收到私聊消息"),
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
        if self.action_type == "post_favorite" and self.post:
            return f"{actor_name} 收藏了你的帖子《{self.post.title}》"
        if self.action_type == "follow":
            return f"{actor_name} 关注了你"
        if self.action_type == "mutual_follow":
            return f"你和 {actor_name} 已互相关注，可以开始私聊啦"
        if self.action_type == "post_share" and self.post:
            return f"{actor_name} 向你分享了帖子《{self.post.title}》"
        if self.action_type == "private_message":
            return f"{actor_name} 给你发送了新的私聊消息"
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


class UserFollow(models.Model):
    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="following_relations",
    )
    following = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="follower_relations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"],
                name="unique_follow_relation",
            ),
            models.CheckConstraint(
                check=~models.Q(follower=models.F("following")),
                name="prevent_self_follow",
            ),
        ]
        indexes = [
            models.Index(fields=["follower"]),
            models.Index(fields=["following"]),
        ]

    def __str__(self) -> str:
        return f"follow {getattr(self, 'follower_id', None)} -> {getattr(self, 'following_id', None)}"

    @classmethod
    def is_following(cls, follower: User, followee: User) -> bool:
        if not follower or not followee or getattr(follower, "pk", None) is None:
            return False
        return cls.objects.filter(follower=follower, following=followee).exists()

    @classmethod
    def is_mutual(cls, user_a: User, user_b: User) -> bool:
        if not user_a or not user_b or getattr(user_a, "pk", None) is None or getattr(user_b, "pk", None) is None:
            return False
        if user_a.pk == user_b.pk:
            return False
        return cls.objects.filter(follower=user_a, following=user_b).exists() and cls.objects.filter(
            follower=user_b, following=user_a
        ).exists()


class PrivateChatThread(models.Model):
    user_a = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="private_chat_threads_a",
    )
    user_b = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="private_chat_threads_b",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user_a", "user_b"], name="unique_private_chat_pair"),
        ]
        indexes = [
            models.Index(fields=["user_a", "updated_at"]),
            models.Index(fields=["user_b", "updated_at"]),
        ]

    def save(self, *args, **kwargs):  # type: ignore[override]
        if getattr(self, "user_a_id", None) and getattr(self, "user_b_id", None):
            if self.user_a_id == self.user_b_id:
                raise ValueError("无法创建与自己私聊的会话")
            if self.user_a_id > self.user_b_id:
                self.user_a, self.user_b = self.user_b, self.user_a
        super().save(*args, **kwargs)

    @classmethod
    def get_or_create_between(cls, user1: User, user2: User) -> tuple["PrivateChatThread", bool]:
        if getattr(user1, "pk", None) is None or getattr(user2, "pk", None) is None:
            raise ValueError("非法用户，无法创建私聊")
        if user1.pk == user2.pk:
            raise ValueError("无法与自己创建私聊会话")
        user_a, user_b = (user1, user2) if user1.pk < user2.pk else (user2, user1)
        thread, created = cls.objects.get_or_create(user_a=user_a, user_b=user_b)
        return thread, created

    def participants(self) -> tuple[User, User]:
        return self.user_a, self.user_b

    def other_participant(self, user: User) -> User | None:
        if getattr(user, "pk", None) == self.user_a_id:
            return self.user_b
        if getattr(user, "pk", None) == self.user_b_id:
            return self.user_a
        return None


class PrivateMessage(models.Model):
    thread = models.ForeignKey(
        PrivateChatThread,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_private_messages",
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["thread", "created_at"]),
            models.Index(fields=["thread", "is_read"]),
        ]

    def save(self, *args, **kwargs):  # type: ignore[override]
        super().save(*args, **kwargs)
        PrivateChatThread.objects.filter(pk=self.thread_id).update(updated_at=Now())

    def __str__(self) -> str:  # pragma: no cover - 简单表示
        return f"PrivateMessage {self.pk} in thread {getattr(self, 'thread_id', None)}"
