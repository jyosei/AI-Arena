# Merged initial migration combining features from both branches:
# - 保留原有简单字段（legacy fields）以保持向后兼容
# - 添加新的结构化模型（分类/标签/反应等）以支持 shallcheer 中的新功能
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 分类与标签（shallcheer）
        migrations.CreateModel(
            name="ForumCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=64, unique=True)),
                ("slug", models.SlugField(max_length=64, unique=True)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "论坛板块",
                "verbose_name_plural": "论坛板块",
                "ordering": ("sort_order", "name"),
            },
        ),
        migrations.CreateModel(
            name="ForumTag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=32, unique=True)),
                ("slug", models.SlugField(max_length=32, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "帖子标签",
                "verbose_name_plural": "帖子标签",
                "ordering": ("name",),
            },
        ),

        # 合并后的 ForumPost（同时包含旧字段与新字段）
        migrations.CreateModel(
            name="ForumPost",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("slug", models.SlugField(blank=True, max_length=220, unique=True)),
                ("content", models.TextField()),
                ("status", models.CharField(choices=[("draft", "草稿"), ("published", "已发布"), ("archived", "已归档")], default="published", max_length=12)),
                ("is_sticky", models.BooleanField(default=False)),
                ("allow_comments", models.BooleanField(default=True)),
                # 兼容旧的简单 category 文本字段
                ("legacy_category", models.CharField(blank=True, choices=[("技术交流", "技术交流"), ("功能建议", "功能建议"), ("作品分享", "作品分享"), ("问题反馈", "问题反馈")], max_length=32, null=True)),
                # legacy tags JSON
                ("legacy_tags", models.JSONField(blank=True, default=list)),
                # 统计字段（包含两套命名以兼容）
                ("views", models.PositiveIntegerField(default=0)),
                ("view_count", models.PositiveIntegerField(default=0)),
                ("like_count", models.PositiveIntegerField(default=0)),
                ("favorite_count", models.PositiveIntegerField(default=0)),
                ("share_count", models.PositiveIntegerField(default=0)),
                ("comment_count", models.PositiveIntegerField(default=0)),
                ("last_activity_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="forum_posts", to=settings.AUTH_USER_MODEL)),
                ("category_obj", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="posts", to="forum.forumcategory")),
            ],
            options={
                "verbose_name": "帖子",
                "verbose_name_plural": "帖子",
                "ordering": ("-is_sticky", "-last_activity_at", "-created_at"),
            },
        ),

        # 多对多 tags（新）
        migrations.AddField(
            model_name="forumpost",
            name="tags",
            field=models.ManyToManyField(blank=True, related_name="posts", to="forum.forumtag"),
        ),

        # ForumComment（合并）
        migrations.CreateModel(
            name="ForumComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content", models.TextField()),
                ("depth", models.PositiveIntegerField(default=0)),
                ("is_deleted", models.BooleanField(default=False)),
                ("like_count", models.PositiveIntegerField(default=0)),
                ("favorite_count", models.PositiveIntegerField(default=0)),
                ("share_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="forum_comments", to=settings.AUTH_USER_MODEL)),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="children", to="forum.forumcomment")),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="forum.forumpost")),
            ],
            options={
                "verbose_name": "评论",
                "verbose_name_plural": "评论",
                "ordering": ("created_at",),
            },
        ),

        # 分享日志（shallcheer）
        migrations.CreateModel(
            name="ForumShareLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("channel", models.CharField(blank=True, max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="share_logs", to="forum.forumpost")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="post_shares", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "分享记录",
                "verbose_name_plural": "分享记录",
                "ordering": ("-created_at",),
            },
        ),

        # 旧的/兼容的 Like 模型（HEAD）
        migrations.CreateModel(
            name="ForumPostLike",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="post_likes", to="forum.forumpost")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="forum_post_likes", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "unique_together": {("post", "user")},
            },
        ),

        migrations.CreateModel(
            name="ForumCommentLike",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("comment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comment_likes", to="forum.forumcomment")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="forum_comment_likes", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "unique_together": {("comment", "user")},
            },
        ),

        # reactions（shallcheer）
        migrations.CreateModel(
            name="ForumCommentReaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reaction_type", models.CharField(choices=[("like", "点赞"), ("favorite", "收藏")], max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("comment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reactions", to="forum.forumcomment")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comment_reactions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "评论互动",
                "verbose_name_plural": "评论互动",
                "unique_together": {("comment", "user", "reaction_type")},
            },
        ),

        migrations.CreateModel(
            name="ForumPostReaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reaction_type", models.CharField(choices=[("like", "点赞"), ("favorite", "收藏")], max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reactions", to="forum.forumpost")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="post_reactions", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "帖子互动",
                "verbose_name_plural": "帖子互动",
                "unique_together": {("post", "user", "reaction_type")},
            },
        ),

        # 图片与附件
        migrations.CreateModel(
            name="ForumPostImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="forum/posts/%Y/%m/%d/")),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="images", to="forum.forumpost")),
            ],
        ),

        migrations.CreateModel(
            name="ForumCommentImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="forum/comments/%Y/%m/%d/")),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("comment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="images", to="forum.forumcomment")),
            ],
            options={
                "ordering": ("-uploaded_at",),
            },
        ),

        migrations.CreateModel(
            name="ForumAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.ImageField(upload_to="forum/attachments/")),
                ("content_type", models.CharField(max_length=64, blank=True)),
                ("size", models.PositiveIntegerField(default=0)),
                ("width", models.PositiveIntegerField(default=0)),
                ("height", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("uploader", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="forum_attachments", to=settings.AUTH_USER_MODEL)),
                ("post", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="forum.forumpost")),
                ("comment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="forum.forumcomment")),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
    ]
