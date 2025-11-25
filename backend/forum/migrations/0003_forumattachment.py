# Generated manually to introduce attachments support
from django.conf import settings
from django.db import migrations, models

import forum.models


class Migration(migrations.Migration):

    dependencies = [
        ("forum", "0002_seed_forum_defaults"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ForumAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.ImageField(upload_to=forum.models.forum_attachment_upload_to)),
                ("content_type", models.CharField(blank=True, max_length=64)),
                ("size", models.PositiveIntegerField(default=0)),
                ("width", models.PositiveIntegerField(default=0)),
                ("height", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "comment",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.CASCADE,
                        related_name="attachments",
                        to="forum.forumcomment",
                    ),
                ),
                (
                    "post",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.CASCADE,
                        related_name="attachments",
                        to="forum.forumpost",
                    ),
                ),
                (
                    "uploader",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="forum_attachments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-created_at",),
                "verbose_name": "附件",
                "verbose_name_plural": "附件",
            },
        ),
    ]
