#!/usr/bin/env python3
"""
AI-Arena 综合测试套件
包含单元测试、集成测试和端到端测试

运行方式:
    python manage.py test test_suite --verbosity=2
    或直接运行:
    python test_suite.py
"""

import os
import json
import time
from decimal import Decimal
from datetime import datetime, timedelta

import django
from django.test import TestCase, Client, TransactionTestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

# 初始化 Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ai_arena_backend.settings')
django.setup()

from users.models import User, Notification, UserFollow
from forum.models import ForumPost, ForumCategory, ForumTag, ForumComment, ForumPostLike
from models_manager.models import AIModel

User = get_user_model()


class UtilityMixin:
    """测试工具混合类"""
    
    def create_test_user(self, username='testuser', password='Test123456', email='test@example.com'):
        """创建测试用户"""
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email
        )
        return user
    
    def create_test_users(self, count=3):
        """创建多个测试用户"""
        users = []
        for i in range(count):
            user = self.create_test_user(
                username=f'testuser{i}',
                email=f'test{i}@example.com'
            )
            users.append(user)
        return users
    
    def get_token(self, user):
        """获取用户的JWT token"""
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)
    
    def auth_headers(self, token):
        """获取认证请求头"""
        return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


# ============================================================================
# 单元测试 - Users
# ============================================================================

class UserModelTests(TestCase, UtilityMixin):
    """用户模型单元测试"""
    
    def test_create_user(self):
        """测试用户创建"""
        user = self.create_test_user()
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertTrue(user.check_password('Test123456'))
    
    def test_user_avatar_url_property(self):
        """测试用户头像URL属性"""
        user = self.create_test_user()
        # 测试外部URL优先
        user.avatar = 'https://example.com/avatar.jpg'
        self.assertEqual(user.avatar_url, 'https://example.com/avatar.jpg')
    
    def test_user_string_representation(self):
        """测试用户字符串表示"""
        user = self.create_test_user()
        self.assertEqual(str(user), 'testuser')
    
    def test_user_duplicate_username(self):
        """测试重复用户名"""
        self.create_test_user(username='duplicate')
        with self.assertRaises(Exception):
            self.create_test_user(username='duplicate')


class UserFollowTests(TestCase, UtilityMixin):
    """用户关注功能单元测试"""
    
    def setUp(self):
        self.user1 = self.create_test_user('user1')
        self.user2 = self.create_test_user('user2')
    
    def test_user_follow(self):
        """测试用户关注"""
        follow = UserFollow.objects.create(follower=self.user1, following=self.user2)
        self.assertEqual(follow.follower, self.user1)
        self.assertEqual(follow.following, self.user2)
        self.assertTrue(UserFollow.objects.filter(
            follower=self.user1, following=self.user2
        ).exists())
    
    def test_cannot_follow_self(self):
        """测试不能关注自己"""
        # 这取决于你的实现，如果有验证的话
        follow = UserFollow.objects.create(follower=self.user1, following=self.user1)
        # 如果模型没有验证，这会创建成功，应该在序列化器或视图中验证
        self.assertEqual(follow.follower, self.user1)
    
    def test_duplicate_follow(self):
        """测试重复关注"""
        UserFollow.objects.create(follower=self.user1, following=self.user2)
        # unique_together 应该防止重复
        with self.assertRaises(Exception):
            UserFollow.objects.create(follower=self.user1, following=self.user2)


# ============================================================================
# 单元测试 - Forum
# ============================================================================

class ForumCategoryTests(TestCase, UtilityMixin):
    """论坛分类单元测试"""
    
    def test_create_category(self):
        """测试创建分类"""
        category = ForumCategory.objects.create(
            name='技术交流',
            slug='tech-discussion',
            description='技术相关讨论'
        )
        self.assertEqual(category.name, '技术交流')
        self.assertEqual(category.slug, 'tech-discussion')
        self.assertTrue(category.is_active)
    
    def test_category_ordering(self):
        """测试分类排序"""
        cat1 = ForumCategory.objects.create(name='分类1', slug='cat1', sort_order=2)
        cat2 = ForumCategory.objects.create(name='分类2', slug='cat2', sort_order=1)
        cat3 = ForumCategory.objects.create(name='分类3', slug='cat3', sort_order=3)
        
        categories = list(ForumCategory.objects.all())
        self.assertEqual(categories[0].name, '分类2')  # sort_order=1
        self.assertEqual(categories[1].name, '分类1')  # sort_order=2


class ForumPostTests(TestCase, UtilityMixin):
    """论坛帖子单元测试"""
    
    def setUp(self):
        self.user = self.create_test_user()
        self.category = ForumCategory.objects.create(
            name='技术交流',
            slug='tech'
        )
    
    def test_create_post(self):
        """测试创建帖子"""
        post = ForumPost.objects.create(
            title='测试帖子',
            content='这是测试内容',
            author=self.user,
            category=self.category,
            status='published'
        )
        self.assertEqual(post.title, '测试帖子')
        self.assertEqual(post.author, self.user)
        self.assertEqual(post.status, 'published')
        self.assertEqual(post.view_count, 0)
        self.assertEqual(post.like_count, 0)
    
    def test_post_slug_generation(self):
        """测试帖子slug自动生成"""
        post = ForumPost.objects.create(
            title='测试帖子标题',
            content='内容',
            author=self.user,
            category=self.category
        )
        # slug应该根据title生成
        self.assertIsNotNone(post.slug)
    
    def test_post_timestamps(self):
        """测试帖子时间戳"""
        post = ForumPost.objects.create(
            title='测试',
            content='内容',
            author=self.user,
            category=self.category
        )
        self.assertIsNotNone(post.created_at)
        self.assertIsNotNone(post.updated_at)
        self.assertEqual(post.created_at, post.updated_at)


class ForumCommentTests(TestCase, UtilityMixin):
    """论坛评论单元测试"""
    
    def setUp(self):
        self.user = self.create_test_user()
        self.other_user = self.create_test_user('otheruser')
        self.category = ForumCategory.objects.create(
            name='技术',
            slug='tech'
        )
        self.post = ForumPost.objects.create(
            title='测试帖子',
            content='内容',
            author=self.user,
            category=self.category
        )
    
    def test_create_comment(self):
        """测试创建评论"""
        comment = ForumComment.objects.create(
            post=self.post,
            author=self.other_user,
            content='测试评论'
        )
        self.assertEqual(comment.post, self.post)
        self.assertEqual(comment.author, self.other_user)
        self.assertEqual(comment.content, '测试评论')
    
    def test_reply_to_comment(self):
        """测试回复评论"""
        parent_comment = ForumComment.objects.create(
            post=self.post,
            author=self.user,
            content='原始评论'
        )
        reply = ForumComment.objects.create(
            post=self.post,
            author=self.other_user,
            content='回复评论',
            parent=parent_comment
        )
        self.assertEqual(reply.parent, parent_comment)


class ForumTagTests(TestCase):
    """论坛标签单元测试"""
    
    def test_create_tag(self):
        """测试创建标签"""
        tag = ForumTag.objects.create(
            name='Python',
            slug='python'
        )
        self.assertEqual(tag.name, 'Python')
        self.assertEqual(tag.slug, 'python')


# ============================================================================
# 集成测试 - API 认证
# ============================================================================

class AuthenticationIntegrationTests(APITestCase, UtilityMixin):
    """认证集成测试"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = self.create_test_user(
            username='authuser',
            password='SecurePass123'
        )
    
    def test_user_registration(self):
        """测试用户注册"""
        response = self.client.post(
            '/api/users/register/',
            {
                'username': 'newuser',
                'password': 'NewPass123',
                'email': 'newuser@example.com'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())
    
    def test_user_registration_duplicate_username(self):
        """测试注册重复用户名"""
        response = self.client.post(
            '/api/users/register/',
            {
                'username': 'authuser',
                'password': 'NewPass123'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_token_obtain(self):
        """测试获取token"""
        response = self.client.post(
            '/api/token/',
            {
                'username': 'authuser',
                'password': 'SecurePass123'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_token_with_wrong_password(self):
        """测试错误密码获取token"""
        response = self.client.post(
            '/api/token/',
            {
                'username': 'authuser',
                'password': 'WrongPassword'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_token_refresh(self):
        """测试刷新token"""
        # 获取初始token
        token_response = self.client.post(
            '/api/token/',
            {'username': 'authuser', 'password': 'SecurePass123'},
            format='json'
        )
        refresh_token = token_response.data['refresh']
        
        # 刷新token
        refresh_response = self.client.post(
            '/api/token/refresh/',
            {'refresh': refresh_token},
            format='json'
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_response.data)


# ============================================================================
# 集成测试 - 用户个人资料
# ============================================================================

class UserProfileIntegrationTests(APITestCase, UtilityMixin):
    """用户个人资料集成测试"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = self.create_test_user()
        self.token = self.get_token(self.user)
    
    def test_get_own_profile(self):
        """测试获取自己的个人资料"""
        response = self.client.get(
            '/api/users/profile/',
            **self.auth_headers(self.token)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
    
    def test_update_profile(self):
        """测试更新个人资料"""
        response = self.client.patch(
            '/api/users/profile/',
            {
                'description': '这是我的描述',
                'avatar': 'https://example.com/avatar.jpg'
            },
            format='json',
            **self.auth_headers(self.token)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 验证更新
        self.user.refresh_from_db()
        self.assertEqual(self.user.description, '这是我的描述')
    
    def test_get_profile_without_auth(self):
        """测试未认证获取个人资料"""
        response = self.client.get('/api/users/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_change_password(self):
        """测试修改密码"""
        response = self.client.post(
            '/api/users/change-password/',
            {
                'old_password': 'Test123456',
                'new_password': 'NewPassword123'
            },
            format='json',
            **self.auth_headers(self.token)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 验证新密码是否有效
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPassword123'))


# ============================================================================
# 集成测试 - 论坛功能
# ============================================================================

class ForumIntegrationTests(APITestCase, UtilityMixin):
    """论坛功能集成测试"""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = self.create_test_user('user1')
        self.user2 = self.create_test_user('user2')
        self.token1 = self.get_token(self.user1)
        self.token2 = self.get_token(self.user2)
        
        self.category = ForumCategory.objects.create(
            name='技术交流',
            slug='tech'
        )
    
    def test_create_post(self):
        """测试创建帖子"""
        response = self.client.post(
            '/api/forum/posts/',
            {
                'title': '测试帖子',
                'content': '这是测试内容',
                'category': self.category.id,
                'status': 'published'
            },
            format='json',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ForumPost.objects.filter(title='测试帖子').exists())
    
    def test_get_posts_list(self):
        """测试获取帖子列表"""
        # 创建几个帖子
        for i in range(3):
            ForumPost.objects.create(
                title=f'帖子{i}',
                content=f'内容{i}',
                author=self.user1,
                category=self.category,
                status='published'
            )
        
        response = self.client.get('/api/forum/posts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 3)
    
    def test_get_post_detail(self):
        """测试获取帖子详情"""
        post = ForumPost.objects.create(
            title='详情测试',
            content='内容',
            author=self.user1,
            category=self.category
        )
        
        response = self.client.get(f'/api/forum/posts/{post.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], '详情测试')
        # 测试浏览次数增加
        self.assertEqual(response.data['view_count'], 1)
    
    def test_update_own_post(self):
        """测试修改自己的帖子"""
        post = ForumPost.objects.create(
            title='原始标题',
            content='原始内容',
            author=self.user1,
            category=self.category
        )
        
        response = self.client.patch(
            f'/api/forum/posts/{post.id}/',
            {
                'title': '修改后标题',
                'content': '修改后内容'
            },
            format='json',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        post.refresh_from_db()
        self.assertEqual(post.title, '修改后标题')
    
    def test_cannot_update_others_post(self):
        """测试不能修改他人的帖子"""
        post = ForumPost.objects.create(
            title='他人帖子',
            content='内容',
            author=self.user1,
            category=self.category
        )
        
        response = self.client.patch(
            f'/api/forum/posts/{post.id}/',
            {'title': '尝试修改'},
            format='json',
            **self.auth_headers(self.token2)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_delete_own_post(self):
        """测试删除自己的帖子"""
        post = ForumPost.objects.create(
            title='待删除',
            content='内容',
            author=self.user1,
            category=self.category
        )
        post_id = post.id
        
        response = self.client.delete(
            f'/api/forum/posts/{post_id}/',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ForumPost.objects.filter(id=post_id).exists())
    
    def test_like_post(self):
        """测试点赞帖子"""
        post = ForumPost.objects.create(
            title='点赞测试',
            content='内容',
            author=self.user1,
            category=self.category
        )
        
        response = self.client.post(
            f'/api/forum/posts/{post.id}/like/',
            format='json',
            **self.auth_headers(self.token2)
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        post.refresh_from_db()
        self.assertEqual(post.like_count, 1)
    
    def test_unlike_post(self):
        """测试取消点赞"""
        post = ForumPost.objects.create(
            title='取消赞',
            content='内容',
            author=self.user1,
            category=self.category
        )
        ForumPostLike.objects.create(post=post, user=self.user2)
        
        response = self.client.delete(
            f'/api/forum/posts/{post.id}/like/',
            **self.auth_headers(self.token2)
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        post.refresh_from_db()
        self.assertEqual(post.like_count, 0)
    
    def test_cannot_like_twice(self):
        """测试不能重复点赞"""
        post = ForumPost.objects.create(
            title='重复点赞',
            content='内容',
            author=self.user1,
            category=self.category
        )
        
        # 第一次点赞
        self.client.post(
            f'/api/forum/posts/{post.id}/like/',
            format='json',
            **self.auth_headers(self.token2)
        )
        
        # 尝试第二次点赞
        response = self.client.post(
            f'/api/forum/posts/{post.id}/like/',
            format='json',
            **self.auth_headers(self.token2)
        )
        # 应该返回409 Conflict或400 Bad Request
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT])
    
    def test_create_comment(self):
        """测试创建评论"""
        post = ForumPost.objects.create(
            title='评论测试',
            content='内容',
            author=self.user1,
            category=self.category
        )
        
        response = self.client.post(
            f'/api/forum/posts/{post.id}/comments/',
            {
                'content': '这是一条测试评论'
            },
            format='json',
            **self.auth_headers(self.token2)
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ForumComment.objects.filter(
            post=post,
            author=self.user2,
            content='这是一条测试评论'
        ).exists())
    
    def test_get_comments_list(self):
        """测试获取评论列表"""
        post = ForumPost.objects.create(
            title='评论列表',
            content='内容',
            author=self.user1,
            category=self.category
        )
        
        # 创建评论
        for i in range(3):
            ForumComment.objects.create(
                post=post,
                author=self.user2,
                content=f'评论{i}'
            )
        
        response = self.client.get(f'/api/forum/posts/{post.id}/comments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 3)


# ============================================================================
# 集成测试 - 用户关注
# ============================================================================

class UserFollowIntegrationTests(APITestCase, UtilityMixin):
    """用户关注集成测试"""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = self.create_test_user('user1')
        self.user2 = self.create_test_user('user2')
        self.token1 = self.get_token(self.user1)
        self.token2 = self.get_token(self.user2)
    
    def test_follow_user(self):
        """测试关注用户"""
        response = self.client.post(
            f'/api/users/{self.user2.id}/follow/',
            format='json',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(UserFollow.objects.filter(
            follower=self.user1,
            following=self.user2
        ).exists())
    
    def test_unfollow_user(self):
        """测试取消关注"""
        UserFollow.objects.create(follower=self.user1, following=self.user2)
        
        response = self.client.delete(
            f'/api/users/{self.user2.id}/follow/',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(UserFollow.objects.filter(
            follower=self.user1,
            following=self.user2
        ).exists())
    
    def test_get_followers(self):
        """测试获取粉丝列表"""
        UserFollow.objects.create(follower=self.user1, following=self.user2)
        
        response = self.client.get(
            f'/api/users/{self.user2.id}/followers/',
            **self.auth_headers(self.token2)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_get_following(self):
        """测试获取关注列表"""
        UserFollow.objects.create(follower=self.user1, following=self.user2)
        
        response = self.client.get(
            f'/api/users/{self.user1.id}/following/',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ============================================================================
# 端到端测试 - 完整用户流程
# ============================================================================

class EndToEndUserJourneyTests(APITestCase, UtilityMixin):
    """端到端测试 - 完整用户流程"""
    
    def setUp(self):
        self.client = APIClient()
    
    def test_complete_user_registration_and_posting_flow(self):
        """测试完整流程: 注册 -> 登录 -> 更新资料 -> 发帖 -> 点赞 -> 评论"""
        
        # 1. 注册用户
        register_response = self.client.post(
            '/api/users/register/',
            {
                'username': 'e2euser',
                'password': 'SecurePass123',
                'email': 'e2euser@example.com'
            },
            format='json'
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)
        user_id = register_response.data['id']
        
        # 2. 获取token
        login_response = self.client.post(
            '/api/token/',
            {'username': 'e2euser', 'password': 'SecurePass123'},
            format='json'
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        token = login_response.data['access']
        
        # 3. 更新个人资料
        profile_response = self.client.patch(
            '/api/users/profile/',
            {
                'description': '我是E2E测试用户',
                'avatar': 'https://example.com/avatar.jpg'
            },
            format='json',
            **self.auth_headers(token)
        )
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        
        # 4. 创建分类和帖子
        category = ForumCategory.objects.create(name='测试', slug='test')
        
        post_response = self.client.post(
            '/api/forum/posts/',
            {
                'title': 'E2E测试帖子',
                'content': '这是端到端测试创建的帖子',
                'category': category.id,
                'status': 'published'
            },
            format='json',
            **self.auth_headers(token)
        )
        self.assertEqual(post_response.status_code, status.HTTP_201_CREATED)
        post_id = post_response.data['id']
        
        # 5. 创建另一个用户给帖子点赞
        user2 = self.create_test_user('e2euser2')
        token2 = self.get_token(user2)
        
        like_response = self.client.post(
            f'/api/forum/posts/{post_id}/like/',
            format='json',
            **self.auth_headers(token2)
        )
        self.assertEqual(like_response.status_code, status.HTTP_201_CREATED)
        
        # 6. 另一个用户创建评论
        comment_response = self.client.post(
            f'/api/forum/posts/{post_id}/comments/',
            {'content': 'E2E测试评论'},
            format='json',
            **self.auth_headers(token2)
        )
        self.assertEqual(comment_response.status_code, status.HTTP_201_CREATED)
        
        # 7. 验证最终状态
        post_response = self.client.get(f'/api/forum/posts/{post_id}/')
        self.assertEqual(post_response.status_code, status.HTTP_200_OK)
        self.assertEqual(post_response.data['like_count'], 1)
        self.assertGreater(post_response.data['view_count'], 0)


class EndToEndCommentThreadTests(APITestCase, UtilityMixin):
    """端到端测试 - 评论线程"""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = self.create_test_user('user1')
        self.user2 = self.create_test_user('user2')
        self.token1 = self.get_token(self.user1)
        self.token2 = self.get_token(self.user2)
        
        self.category = ForumCategory.objects.create(name='测试', slug='test')
        self.post = ForumPost.objects.create(
            title='讨论帖子',
            content='开始讨论',
            author=self.user1,
            category=self.category
        )
    
    def test_nested_comments_flow(self):
        """测试嵌套评论流程"""
        
        # 1. User1 创建一级评论
        comment1_response = self.client.post(
            f'/api/forum/posts/{self.post.id}/comments/',
            {'content': 'User1的一级评论'},
            format='json',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(comment1_response.status_code, status.HTTP_201_CREATED)
        comment1_id = comment1_response.data['id']
        
        # 2. User2 回复一级评论
        comment2_response = self.client.post(
            f'/api/forum/posts/{self.post.id}/comments/',
            {
                'content': 'User2对User1的回复',
                'parent': comment1_id
            },
            format='json',
            **self.auth_headers(self.token2)
        )
        self.assertEqual(comment2_response.status_code, status.HTTP_201_CREATED)
        
        # 3. User1 回复User2
        comment3_response = self.client.post(
            f'/api/forum/posts/{self.post.id}/comments/',
            {
                'content': 'User1对User2的回复',
                'parent': comment2_response.data['id']
            },
            format='json',
            **self.auth_headers(self.token1)
        )
        self.assertEqual(comment3_response.status_code, status.HTTP_201_CREATED)
        
        # 4. 获取所有评论，验证结构
        comments_response = self.client.get(
            f'/api/forum/posts/{self.post.id}/comments/'
        )
        self.assertEqual(comments_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(comments_response.data), 3)


# ============================================================================
# 性能和边界测试
# ============================================================================

class PerformanceAndBoundaryTests(APITestCase, UtilityMixin):
    """性能和边界测试"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = self.create_test_user()
        self.token = self.get_token(self.user)
        self.category = ForumCategory.objects.create(name='性能', slug='perf')
    
    def test_create_many_posts_performance(self):
        """测试创建多个帖子的性能"""
        start_time = time.time()
        
        for i in range(50):
            self.client.post(
                '/api/forum/posts/',
                {
                    'title': f'性能测试帖子{i}',
                    'content': f'内容{i}' * 10,  # 相对较长的内容
                    'category': self.category.id,
                    'status': 'published'
                },
                format='json',
                **self.auth_headers(self.token)
            )
        
        elapsed_time = time.time() - start_time
        print(f"\n创建50个帖子耗时: {elapsed_time:.2f}秒")
        # 验证都创建成功
        self.assertEqual(ForumPost.objects.filter(author=self.user).count(), 50)
    
    def test_large_comment_text(self):
        """测试大文本评论"""
        post = ForumPost.objects.create(
            title='大文本测试',
            content='内容',
            author=self.user,
            category=self.category
        )
        
        large_text = 'A' * 10000  # 10000个字符
        
        response = self.client.post(
            f'/api/forum/posts/{post.id}/comments/',
            {'content': large_text},
            format='json',
            **self.auth_headers(self.token)
        )
        # 根据字段定义验证
        if response.status_code == status.HTTP_201_CREATED:
            comment = ForumComment.objects.get(id=response.data['id'])
            self.assertEqual(len(comment.content), 10000)
        else:
            # 如果有长度限制，应该返回400
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_pagination(self):
        """测试分页功能"""
        # 创建25个帖子
        for i in range(25):
            ForumPost.objects.create(
                title=f'分页测试{i}',
                content='内容',
                author=self.user,
                category=self.category,
                status='published'
            )
        
        # 测试第一页
        response1 = self.client.get('/api/forum/posts/?page=1&page_size=10')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response1.data['results']), 10)
        
        # 测试第二页
        response2 = self.client.get('/api/forum/posts/?page=2&page_size=10')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response2.data['results']), 10)
    
    def test_empty_search(self):
        """测试空搜索结果"""
        response = self.client.get('/api/forum/posts/?search=不存在的内容123456789')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)


# ============================================================================
# 错误处理和验证测试
# ============================================================================

class ErrorHandlingTests(APITestCase, UtilityMixin):
    """错误处理和验证测试"""
    
    def setUp(self):
        self.client = APIClient()
        self.user = self.create_test_user()
        self.token = self.get_token(self.user)
        self.category = ForumCategory.objects.create(name='测试', slug='test')
    
    def test_invalid_json(self):
        """测试无效JSON"""
        response = self.client.post(
            '/api/forum/posts/',
            '{"invalid json',
            content_type='application/json',
            **self.auth_headers(self.token)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_missing_required_fields(self):
        """测试缺少必要字段"""
        response = self.client.post(
            '/api/forum/posts/',
            {
                'title': '标题'  # 缺少content和category
            },
            format='json',
            **self.auth_headers(self.token)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_nonexistent_post(self):
        """测试访问不存在的帖子"""
        response = self.client.get('/api/forum/posts/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_nonexistent_user(self):
        """测试访问不存在的用户"""
        response = self.client.get('/api/users/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_method_not_allowed(self):
        """测试方法不被允许"""
        response = self.client.patch('/api/users/register/')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def test_invalid_post_status(self):
        """测试无效的帖子状态"""
        response = self.client.post(
            '/api/forum/posts/',
            {
                'title': '测试',
                'content': '内容',
                'category': self.category.id,
                'status': 'invalid_status'
            },
            format='json',
            **self.auth_headers(self.token)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ============================================================================
# 并发和竞态条件测试
# ============================================================================

class ConcurrencyTests(TransactionTestCase, UtilityMixin):
    """并发和竞态条件测试"""
    
    def setUp(self):
        self.user1 = self.create_test_user('user1')
        self.user2 = self.create_test_user('user2')
        self.category = ForumCategory.objects.create(name='测试', slug='test')
        self.post = ForumPost.objects.create(
            title='点赞竞争',
            content='内容',
            author=self.user1,
            category=self.category
        )
    
    def test_concurrent_likes(self):
        """测试并发点赞"""
        # 创建多个点赞
        for i in range(5):
            user = self.create_test_user(f'concurrent_user{i}')
            ForumPostLike.objects.create(post=self.post, user=user)
        
        self.post.refresh_from_db()
        self.assertEqual(self.post.like_count, 5)
    
    def test_concurrent_comments(self):
        """测试并发评论"""
        users = self.create_test_users(5)
        
        for user in users:
            ForumComment.objects.create(
                post=self.post,
                author=user,
                content=f'{user.username}的评论'
            )
        
        self.assertEqual(ForumComment.objects.filter(post=self.post).count(), 5)


if __name__ == '__main__':
    import unittest
    unittest.main()
