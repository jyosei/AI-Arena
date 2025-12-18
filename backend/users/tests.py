from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class FollowAPITests(APITestCase):
	def setUp(self):
		User = get_user_model()
		self.alice = User.objects.create_user(username="alice", password="pass1234")
		self.bob = User.objects.create_user(username="bob", password="pass1234")

	def test_follow_status_endpoint(self):
		url = reverse("user-follow", kwargs={"user_id": self.bob.pk})
		self.client.force_authenticate(user=self.alice)
		response = self.client.get(url)
		self.assertNotEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR, response.data)
