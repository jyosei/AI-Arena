from django.test import TestCase
from django.contrib.auth import get_user_model


class UserAPITest(TestCase):
	def setUp(self):
		self.User = get_user_model()
		self.password = 'userpass123'
		self.user = self.User.objects.create_user(username='u1', password=self.password)

	def jwt_headers(self):
		res = self.client.post('/api/token/', {
			'username': self.user.username,
			'password': self.password
		}, content_type='application/json')
		self.assertEqual(res.status_code, 200, res.content)
		return {'HTTP_AUTHORIZATION': f"Bearer {res.json()['access']}"}

	def test_profile_retrieve(self):
		res = self.client.get('/api/users/profile/', **self.jwt_headers())
		self.assertEqual(res.status_code, 200)
		data = res.json()
		self.assertEqual(data['username'], 'u1')
		# avatar_url 字段应存在（可能为空字符串）
		self.assertIn('avatar_url', data)

	def test_update_description(self):
		headers = self.jwt_headers()
		res = self.client.patch('/api/users/profile/', {'description': 'hello world'}, content_type='application/json', **headers)
		self.assertEqual(res.status_code, 200, res.content)
		self.assertEqual(res.json()['description'], 'hello world')
