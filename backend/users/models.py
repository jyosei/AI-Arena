from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    description = models.TextField(blank=True)
    avatar = models.URLField(blank=True)
