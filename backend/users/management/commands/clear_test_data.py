from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.conf import settings


class Command(BaseCommand):
    help = (
        "清理常见的测试数据（保留数据集文件）。\n"
        "--dry-run 仅显示将被删除的对象计数。\n"
        "--confirm 实际执行删除（谨慎）。"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="仅显示将被删除的对象计数，默认不实际删除。",
        )
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="确认删除匹配的测试数据（危险操作）。",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run")
        confirm = options.get("confirm")

        # 延迟导入，避免在非 Django 环境时报错
        from django.contrib.auth import get_user_model

        User = get_user_model()

        # 识别测试用户的常见规则（可根据需要扩展）
        test_user_q = Q(username__istartswith="test") | Q(username__icontains="test") | Q(email__icontains="test") | Q(username__icontains="tmp_") | Q(username__icontains="_test")

        test_users = User.objects.filter(test_user_q).exclude(Q(is_staff=True) | Q(is_superuser=True))

        # 导入目标模型
        try:
            from forum.models import (
                ForumPost,
                ForumComment,
                ForumAttachment,
                ForumPostReaction,
                ForumCommentReaction,
                ForumPostFavorite,
                ForumPostViewHistory,
                ForumPostShare,
            )
        except Exception:
            ForumPost = ForumComment = ForumAttachment = ForumPostReaction = ForumCommentReaction = ForumPostFavorite = ForumPostViewHistory = ForumPostShare = None

        try:
            from users.models import Notification, PrivateMessage, PrivateChatThread
        except Exception:
            Notification = PrivateMessage = PrivateChatThread = None

        try:
            from models_manager.models import DatasetEvaluationResult, ModelTestResult, BattleVote, ChatConversation, ChatMessage
        except Exception:
            DatasetEvaluationResult = ModelTestResult = BattleVote = ChatConversation = ChatMessage = None

        # 构造基于用户的过滤条件
        user_filter = Q(author__in=test_users) | Q(uploader__in=test_users) | Q(sender__in=test_users) | Q(receiver__in=test_users)

        # 额外的文本模式匹配（帖子/评论中含有 'test' 或 '测试'）
        text_q = Q()
        if ForumPost is not None:
            text_q = Q(title__icontains="test") | Q(content__icontains="test") | Q(title__icontains="测试") | Q(content__icontains="测试")

        # 统计
        summary = []

        if ForumPost is not None:
            posts_qs = ForumPost.objects.filter(Q(author__in=test_users) | text_q)
            summary.append(("forum posts", posts_qs.count()))
        else:
            posts_qs = None

        if ForumComment is not None:
            comments_qs = ForumComment.objects.filter(Q(author__in=test_users) | Q(content__icontains="test") | Q(content__icontains="测试"))
            summary.append(("forum comments", comments_qs.count()))
        else:
            comments_qs = None

        if ForumAttachment is not None:
            attachments_qs = ForumAttachment.objects.filter(Q(uploader__in=test_users) | Q(post__in=posts_qs) | Q(comment__in=comments_qs))
            summary.append(("forum attachments", attachments_qs.count()))
        else:
            attachments_qs = None

        if ForumPostReaction is not None:
            pr_qs = ForumPostReaction.objects.filter(Q(user__in=test_users) | Q(post__in=posts_qs))
            summary.append(("post reactions", pr_qs.count()))
        else:
            pr_qs = None

        if ForumCommentReaction is not None:
            cr_qs = ForumCommentReaction.objects.filter(Q(user__in=test_users) | Q(comment__in=comments_qs))
            summary.append(("comment reactions", cr_qs.count()))
        else:
            cr_qs = None

        if ForumPostFavorite is not None:
            fav_qs = ForumPostFavorite.objects.filter(Q(user__in=test_users) | Q(post__in=posts_qs))
            summary.append(("post favorites", fav_qs.count()))
        else:
            fav_qs = None

        if ForumPostViewHistory is not None:
            view_qs = ForumPostViewHistory.objects.filter(Q(user__in=test_users) | Q(post__in=posts_qs))
            summary.append(("post view histories", view_qs.count()))
        else:
            view_qs = None

        if ForumPostShare is not None:
            share_qs = ForumPostShare.objects.filter(Q(sender__in=test_users) | Q(receiver__in=test_users) | Q(post__in=posts_qs))
            summary.append(("post shares", share_qs.count()))
        else:
            share_qs = None

        if Notification is not None:
            notif_qs = Notification.objects.filter(Q(recipient__in=test_users) | Q(actor__in=test_users))
            summary.append(("notifications", notif_qs.count()))
        else:
            notif_qs = None

        if PrivateMessage is not None:
            pm_qs = PrivateMessage.objects.filter(Q(sender__in=test_users) | Q(thread__user_a__in=test_users) | Q(thread__user_b__in=test_users))
            summary.append(("private messages", pm_qs.count()))
        else:
            pm_qs = None

        if PrivateChatThread is not None:
            thread_qs = PrivateChatThread.objects.filter(Q(user_a__in=test_users) | Q(user_b__in=test_users))
            summary.append(("private chat threads", thread_qs.count()))
        else:
            thread_qs = None

        if ChatMessage is not None:
            chat_msg_qs = ChatMessage.objects.filter(Q(conversation__user__in=test_users) | Q(conversation__user__in=test_users))
            summary.append(("chat messages", chat_msg_qs.count()))
        else:
            chat_msg_qs = None

        if ChatConversation is not None:
            conv_qs = ChatConversation.objects.filter(Q(user__in=test_users))
            summary.append(("chat conversations", conv_qs.count()))
        else:
            conv_qs = None

        if DatasetEvaluationResult is not None:
            ev_qs = DatasetEvaluationResult.objects.filter(Q(user__in=test_users))
            summary.append(("dataset evaluation results", ev_qs.count()))
        else:
            ev_qs = None

        if ModelTestResult is not None:
            mtr_qs = ModelTestResult.objects.filter(Q(created_by__in=test_users))
            summary.append(("model test results", mtr_qs.count()))
        else:
            mtr_qs = None

        if BattleVote is not None:
            bv_qs = BattleVote.objects.filter(Q(voter__in=test_users))
            summary.append(("battle votes", bv_qs.count()))
        else:
            bv_qs = None

        # 输出预览
        self.stdout.write(self.style.MIGRATE_HEADING("将要清理的对象清单（按类型计数）："))
        for name, cnt in summary:
            self.stdout.write(f" - {name}: {cnt}")

        user_count = test_users.count()
        self.stdout.write(f"匹配到的测试用户数: {user_count}")

        if dry_run or not confirm:
            self.stdout.write("")
            if dry_run:
                self.stdout.write(self.style.SUCCESS("这是一次 dry-run；未执行删除。若要实际删除，请使用 --confirm 参数。"))
            else:
                self.stdout.write(self.style.WARNING("未提供 --confirm；不会执行删除。"))
            return

        # 实际删除
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("开始删除，操作不可逆，请确保已备份数据库。"))

        with transaction.atomic():
            # 以安全顺序删除依赖对象
            if attachments_qs is not None and attachments_qs.exists():
                attachments_qs.delete()
            if pr_qs is not None and pr_qs.exists():
                pr_qs.delete()
            if cr_qs is not None and cr_qs.exists():
                cr_qs.delete()
            if fav_qs is not None and fav_qs.exists():
                fav_qs.delete()
            if view_qs is not None and view_qs.exists():
                view_qs.delete()
            if share_qs is not None and share_qs.exists():
                share_qs.delete()
            if comments_qs is not None and comments_qs.exists():
                comments_qs.delete()
            if posts_qs is not None and posts_qs.exists():
                posts_qs.delete()

            if notif_qs is not None and notif_qs.exists():
                notif_qs.delete()
            if pm_qs is not None and pm_qs.exists():
                pm_qs.delete()
            if thread_qs is not None and thread_qs.exists():
                thread_qs.delete()

            if chat_msg_qs is not None and chat_msg_qs.exists():
                chat_msg_qs.delete()
            if conv_qs is not None and conv_qs.exists():
                conv_qs.delete()

            if ev_qs is not None and ev_qs.exists():
                ev_qs.delete()
            if mtr_qs is not None and mtr_qs.exists():
                mtr_qs.delete()
            if bv_qs is not None and bv_qs.exists():
                bv_qs.delete()

            # 最后删除用户（排除 staff/superuser）
            if user_count:
                test_users.delete()

        self.stdout.write(self.style.SUCCESS("测试数据已删除完成。"))
