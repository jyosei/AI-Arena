from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch
from rest_framework import status


class GitHubExchangeTests(TestCase):
    @patch('users.github_views.github_exchange_code_for_token')
    @patch('users.github_views.github_fetch_profile')
    @patch('users.github_views.github_fetch_primary_email')
    def test_github_exchange_success(self, mock_email, mock_profile, mock_exchange):
        # 模拟 token 交换成功
        mock_exchange.return_value = {'access_token': 'FAKE_TOKEN'}
        mock_profile.return_value = {'id': 123456, 'login': 'gh_test'}
        mock_email.return_value = 'gh_test@example.com'

        url = reverse('github-code-exchange')
        resp = self.client.get(url + '?code=FAKECODE')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn('access_token', data)
        self.assertIn('refresh_token', data)
