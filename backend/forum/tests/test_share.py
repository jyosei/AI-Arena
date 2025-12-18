from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from forum.models import ForumPost, ForumPostShare
from users.models import UserFollow


class ForumShareAPITests(APITestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.author = User.objects.create_user(username="author", password="pass1234")
        self.post = ForumPost.objects.create(author=self.author, title="测试帖子", content="正文")

    def test_anonymous_share_increments_counter(self) -> None:
        url = reverse("forum-post-share", kwargs={"pk": self.post.pk})
        response = self.client.post(url, {"channel": "web"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.post.refresh_from_db()
        self.assertEqual(self.post.share_count, 1)
        self.assertEqual(response.data.get("share_count"), 1)

    def test_mutual_follow_share_creates_records(self) -> None:
        User = get_user_model()
        sender = User.objects.create_user(username="sender", password="pass1234")
        receiver = User.objects.create_user(username="receiver", password="pass1234")
        UserFollow.objects.create(follower=sender, following=receiver)
        UserFollow.objects.create(follower=receiver, following=sender)
        post = ForumPost.objects.create(author=sender, title="好友分享", content="内容")

        url = reverse("forum-post-share", kwargs={"pk": post.pk})
        self.client.force_authenticate(user=sender)
        payload = {"targets": [receiver.pk], "note": "快来看"}
        response = self.client.post(url, payload, format="json")
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 200, response.data)
        post.refresh_from_db()
        self.assertEqual(post.share_count, 1)
        self.assertEqual(response.data.get("shared"), 1, response.data)
        self.assertTrue(
            ForumPostShare.objects.filter(post=post, sender=sender, receiver=receiver).exists()
        )

    def test_requires_mutual_follow_for_friend_share(self) -> None:
        User = get_user_model()
        sender = User.objects.create_user(username="sender2", password="pass1234")
        stranger = User.objects.create_user(username="stranger", password="pass1234")
        post = ForumPost.objects.create(author=sender, title="互关校验", content="内容")

        url = reverse("forum-post-share", kwargs={"pk": post.pk})
        self.client.force_authenticate(user=sender)
        response = self.client.post(url, {"targets": [stranger.pk]}, format="json")
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 400, response.data)
        post.refresh_from_db()
        self.assertEqual(post.share_count, 0)
