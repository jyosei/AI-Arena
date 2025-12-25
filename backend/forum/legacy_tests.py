from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from forum.models import ForumCategory, ForumPost


class ForumAPITest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.password = 'pass1234'
        self.user = User.objects.create_user(username='tester', password=self.password)
        # 确保分类存在且 slug 非空
        names = ['技术交流', '功能建议', '作品分享', '问题反馈']
        for name in names:
            cat, _ = ForumCategory.objects.get_or_create(
                name=name,
                defaults={'slug': slugify(name) or 'slug-'+name}
            )
            if not cat.slug:
                cat.slug = slugify(cat.name) or f"{cat.pk}-fallback"
                cat.save(update_fields=['slug'])
        self.category = ForumCategory.objects.first()

    def jwt_headers(self):
        # 获取 JWT token
        res = self.client.post('/api/token/', {
            'username': self.user.username,
            'password': self.password
        }, content_type='application/json')
        self.assertEqual(res.status_code, 200, res.content)
        access = res.json()['access']
        return {'HTTP_AUTHORIZATION': f'Bearer {access}'}

    def test_get_categories(self):
        url = '/api/forum/categories/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)
        self.assertTrue(all('slug' in c and c['slug'] for c in data))

    def test_create_post_with_category(self):
        url = '/api/forum/posts/'
        payload = {
            'title': '测试标题',
            'content': '测试内容',
            'category': self.category.id,
            'tags': ['tagA', 'tagB']
        }
        res = self.client.post(url, payload, content_type='application/json', **self.jwt_headers())
        self.assertEqual(res.status_code, 201, res.content)
        post_id = res.json().get('id')
        post = ForumPost.objects.get(pk=post_id)
        self.assertEqual(post.category_obj_id, self.category.id)
        self.assertEqual(post.tags.count(), 2)

    def test_create_post_with_category_id_alias(self):
        url = '/api/forum/posts/'
        payload = {
            'title': '别名字段测试',
            'content': '内容X',
            'category_id': self.category.id,
            'tags': []
        }
        res = self.client.post(url, payload, content_type='application/json', **self.jwt_headers())
        self.assertEqual(res.status_code, 201, res.content)
        post = ForumPost.objects.get(pk=res.json().get('id'))
        self.assertEqual(post.category_obj_id, self.category.id)

    def test_create_post_legacy_category_only(self):
        url = '/api/forum/posts/'
        payload = {
            'title': '仅 legacy 分类',
            'content': '内容legacy',
            'legacy_category': '功能建议',
            'tags': []
        }
        res = self.client.post(url, payload, content_type='application/json', **self.jwt_headers())
        self.assertEqual(res.status_code, 201, res.content)
        post = ForumPost.objects.get(pk=res.json().get('id'))
        self.assertIsNone(post.category_obj_id)
        self.assertEqual(post.legacy_category, '功能建议')
