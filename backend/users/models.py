from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    description = models.TextField(blank=True)
    avatar = models.URLField(blank=True)

    # 为了解决与默认 User 模型的冲突，重新定义 ManyToMany 字段并添加 related_name
    groups = models.ManyToManyField(
        Group,
        verbose_name=_('groups'),
        blank=True,
        help_text=_(
            'The groups this user belongs to. A user will get all permissions '
            'granted to each of their groups.'
        ),
        related_name="custom_user_set",  # 使用自定义的 related_name
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name=_('user permissions'),
        blank=True,
        help_text=_('Specific permissions for this user.'),
        related_name="custom_user_permissions_set", # 使用自定义的 related_name
        related_query_name="user",
    )

    def __str__(self):
        return self.username
