# 测试指南

本文档介绍如何测试 AI-Arena 的各项功能。

> 编辑: shallcheer

## 目录

- [环境准备](#环境准备)
- [API 测试](#api-测试)
- [功能测试](#功能测试)
- [自动化测试](#自动化测试)

---

## 环境准备

### 1. 启动开发环境

```bash
# 启动所有服务
docker compose up -d

# 确认服务运行正常
docker compose ps
```

### 2. 创建测试用户

```bash
# 方法1: 通过 API 注册
curl -X POST http://localhost:8000/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123456"}'

# 方法2: 创建管理员
docker exec -it ai-arena-backend-1 python manage.py createsuperuser
```

---

## API 测试

### 使用 curl 测试

#### 1. 注册用户

```bash
curl -X POST http://localhost:8000/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser123",
    "password": "Password123"
  }'
```

**期望响应**:
```json
{
  "id": 1,
  "username": "testuser123",
  "description": "",
  "avatar": "",
  "avatar_url": ""
}
```

#### 2. 登录获取 Token

```bash
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser123",
    "password": "Password123"
  }'
```

**期望响应**:
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 3. 获取用户资料

```bash
# 保存 access token
TOKEN="your_access_token_here"

curl -X GET http://localhost:8000/api/users/profile/ \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. 创建论坛帖子

```bash
curl -X POST http://localhost:8000/api/forum/posts/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试帖子",
    "content": "这是一个测试帖子的内容",
    "status": "published",
    "allow_comments": true
  }'
```

#### 5. 获取帖子列表

```bash
curl -X GET "http://localhost:8000/api/forum/posts/?page=1&page_size=10"
```

#### 6. 点赞帖子

```bash
# 假设帖子 ID 为 1
curl -X POST http://localhost:8000/api/forum/posts/1/like/ \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. 创建评论

```bash
curl -X POST http://localhost:8000/api/forum/posts/1/comments/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "这是一条测试评论"
  }'
```

### 使用 Python 脚本测试

创建 `test_api.py`:

```python
#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_register():
    """测试用户注册"""
    print("=== 测试注册 ===")
    response = requests.post(
        f"{BASE_URL}/users/register/",
        json={
            "username": f"testuser_{int(time.time())}",
            "password": "Test123456"
        }
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    return response.json()

def test_login(username, password):
    """测试登录"""
    print("\n=== 测试登录 ===")
    response = requests.post(
        f"{BASE_URL}/token/",
        json={"username": username, "password": password}
    )
    print(f"状态码: {response.status_code}")
    data = response.json()
    print(f"获取到 Token: {data['access'][:20]}...")
    return data['access']

def test_get_profile(token):
    """测试获取用户资料"""
    print("\n=== 测试获取用户资料 ===")
    response = requests.get(
        f"{BASE_URL}/users/profile/",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"状态码: {response.status_code}")
    print(f"用户信息: {response.json()}")

def test_create_post(token):
    """测试创建帖子"""
    print("\n=== 测试创建帖子 ===")
    response = requests.post(
        f"{BASE_URL}/forum/posts/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "测试帖子",
            "content": "这是测试内容",
            "status": "published"
        }
    )
    print(f"状态码: {response.status_code}")
    print(f"帖子信息: {response.json()}")
    return response.json()['id']

def test_like_post(token, post_id):
    """测试点赞帖子"""
    print("\n=== 测试点赞帖子 ===")
    response = requests.post(
        f"{BASE_URL}/forum/posts/{post_id}/like/",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")

if __name__ == "__main__":
    import time
    
    # 注册
    user_data = test_register()
    username = user_data['username']
    password = "Test123456"
    
    # 登录
    token = test_login(username, password)
    
    # 获取资料
    test_get_profile(token)
    
    # 创建帖子
    post_id = test_create_post(token)
    
    # 点赞帖子
    test_like_post(token, post_id)
    
    print("\n✅ 所有测试完成!")
```

运行测试:

```bash
python test_api.py
```

---

## 功能测试

### 1. 用户注册和登录流程

**测试步骤**:

1. 访问 http://localhost:8000
2. 点击右上角"用户中心"
3. 切换到"注册"标签
4. 输入用户名和密码（两次）
5. 点击"注册"按钮
6. 验证是否自动登录成功

**预期结果**:
- 注册成功后显示成功提示
- 自动登录并跳转到用户中心
- 右上角显示用户名

### 2. 论坛功能测试

#### 发帖测试

1. 点击"论坛"
2. 点击"发帖"按钮
3. 输入标题和内容
4. 选择分类（如果有）
5. 点击"发布"

**预期结果**:
- 帖子创建成功
- 在帖子列表中看到新帖子

#### 评论测试

1. 打开任意帖子
2. 在评论框输入内容
3. 点击"发表评论"

**预期结果**:
- 评论成功发布
- 帖子的评论数加1

#### 点赞测试

1. 在帖子列表或详情页点击"点赞"图标
2. 再次点击取消点赞

**预期结果**:
- 点赞数正确增减
- 图标状态正确变化

### 3. AI 对话测试

1. 点击"AI 对战"
2. 输入问题
3. 点击"发送"

**预期结果**:
- 显示 AI 回复
- 可以继续对话

### 4. 模型对战测试

1. 点击"模型对战"
2. 选择两个模型
3. 输入问题
4. 点击"开始对战"

**预期结果**:
- 同时显示两个模型的回答
- 可以投票选择更好的回答

### 5. 排行榜测试

1. 点击"排行榜"
2. 查看模型排名

**预期结果**:
- 显示模型列表
- 按分数排序

---

## 自动化测试

### Django 单元测试

运行后端测试:

```bash
# 运行所有测试
docker exec ai-arena-backend-1 python manage.py test

# 运行特定应用的测试
docker exec ai-arena-backend-1 python manage.py test users
docker exec ai-arena-backend-1 python manage.py test forum

# 显示详细输出
docker exec ai-arena-backend-1 python manage.py test --verbosity=2
```

### 创建测试用例

在 `backend/users/tests.py` 中添加:

```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

class UserTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
    def test_register_user(self):
        """测试用户注册"""
        response = self.client.post('/api/users/register/', {
            'username': 'testuser',
            'password': 'Test123456'
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.count(), 1)
        
    def test_login_user(self):
        """测试用户登录"""
        # 创建用户
        user = User.objects.create_user(
            username='testuser',
            password='Test123456'
        )
        
        # 登录
        response = self.client.post('/api/token/', {
            'username': 'testuser',
            'password': 'Test123456'
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())
```

### 前端测试（可选）

如果使用 Jest 和 React Testing Library:

```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm test
```

---

## 性能测试

### 使用 Apache Bench

```bash
# 测试首页加载
ab -n 1000 -c 10 http://localhost:8000/

# 测试 API 端点
ab -n 1000 -c 10 http://localhost:8000/api/forum/posts/
```

### 使用 wrk

```bash
# 安装 wrk
# Ubuntu: sudo apt install wrk
# Mac: brew install wrk

# 测试 API
wrk -t4 -c100 -d30s http://localhost:8000/api/forum/posts/
```

---

## 数据库测试

### 检查数据完整性

```bash
# 连接到数据库
docker exec -it ai-arena-db-1 mysql -uroot -p123456 aiarena

# 查询统计
SELECT 
    COUNT(*) as user_count 
FROM users_user;

SELECT 
    COUNT(*) as post_count,
    SUM(view_count) as total_views,
    SUM(like_count) as total_likes
FROM forum_forumpost;

# 检查孤立数据
SELECT * FROM forum_forumpost WHERE author_id NOT IN (SELECT id FROM users_user);
```

---

## 测试检查清单

### 功能测试

- [ ] 用户注册
- [ ] 用户登录
- [ ] 密码重置
- [ ] 个人资料更新
- [ ] 头像上传
- [ ] 发布帖子
- [ ] 编辑帖子
- [ ] 删除帖子
- [ ] 评论功能
- [ ] 点赞功能
- [ ] 收藏功能
- [ ] 搜索功能
- [ ] 分页功能
- [ ] AI 对话
- [ ] 模型对战
- [ ] 投票功能
- [ ] 排行榜显示
- [ ] 通知系统

### 安全测试

- [ ] SQL 注入测试
- [ ] XSS 测试
- [ ] CSRF 保护
- [ ] 未授权访问测试
- [ ] 文件上传安全

### 兼容性测试

- [ ] Chrome 浏览器
- [ ] Firefox 浏览器
- [ ] Safari 浏览器
- [ ] Edge 浏览器
- [ ] 移动端响应式

### 性能测试

- [ ] 首页加载速度 < 2s
- [ ] API 响应时间 < 500ms
- [ ] 并发用户 100+ 无错误
- [ ] 数据库查询优化

---

## 测试工具推荐

### API 测试
- **Postman** - 图形化 API 测试工具
- **curl** - 命令行工具
- **httpie** - 更友好的 curl 替代

### 浏览器测试
- **Chrome DevTools** - 浏览器开发者工具
- **React DevTools** - React 组件调试
- **Redux DevTools** - 状态管理调试

### 性能测试
- **Lighthouse** - 网页性能分析
- **WebPageTest** - 在线性能测试
- **Apache Bench** - 压力测试

### 数据库工具
- **MySQL Workbench** - MySQL 图形化管理
- **DBeaver** - 通用数据库工具

---

## 报告问题

如果发现 Bug，请提交 Issue 并包含以下信息：

1. 问题描述
2. 复现步骤
3. 期望结果
4. 实际结果
5. 浏览器/系统信息
6. 错误截图或日志

---

**祝测试顺利！** 🧪
