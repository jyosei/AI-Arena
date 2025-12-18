# Generated manually to fix missing migration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='action_type',
            field=models.CharField(choices=[('post_like', '帖子被点赞'), ('post_comment', '帖子收到评论'), ('comment_reply', '评论被回复'), ('comment_like', '评论被点赞'), ('post_favorite', '帖子被收藏'), ('follow', '获得新关注'), ('mutual_follow', '互相关注'), ('post_share', '帖子被分享'), ('private_message', '收到私聊消息')], max_length=32),
        ),
    ]