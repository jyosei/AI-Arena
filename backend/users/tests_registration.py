from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from users.models import User


class RegistrationTests(TestCase):
    def test_register_with_password_and_email(self):
        url = reverse('register')
        resp = self.client.post(url, {'username': 'unittest_user', 'password': 'unittest123', 'email': 'u@example.com'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='unittest_user').exists())
