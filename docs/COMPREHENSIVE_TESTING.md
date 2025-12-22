# AI-Arena 综合测试指南

本文档介绍如何使用完整的测试套件对 AI-Arena 进行全面测试。

## 📋 目录

- [快速开始](#快速开始)
- [测试类型](#测试类型)
- [后端测试](#后端测试)
- [前端测试](#前端测试)
- [CI/CD 集成](#cicd-集成)
- [测试报告](#测试报告)
- [最佳实践](#最佳实践)

---

## 🚀 快速开始

### 前置要求

1. **后端环境**:
   ```bash
   cd backend
   pip install -r requirements.txt
   # 添加测试依赖
   pip install coverage pytest pytest-django
   ```

2. **前端环境**:
   ```bash
   cd frontend
   npm install
   npm install --save-dev axios
   ```

3. **启动服务**:
   ```bash
   docker compose up -d
   ```

### 快速测试

```bash
# 运行所有测试
cd backend
python manage.py test test_suite

# 运行特定类别的测试
python run_comprehensive_tests.py --unit
python run_comprehensive_tests.py --integration
python run_comprehensive_tests.py --e2e

# 前端端到端测试
cd ..
node test-e2e.js
```

---

## 🧪 测试类型

### 1. 单元测试 (Unit Tests)

**目的**: 测试单个模块或函数的功能

**包含内容**:
- 用户模型测试
- 论坛模型测试
- 标签和分类测试

**命令**:
```bash
python manage.py test test_suite --verbosity=2
# 或
python run_comprehensive_tests.py --unit
```

**示例测试**:
```python
def test_create_user(self):
    """测试用户创建"""
    user = self.create_test_user()
    self.assertEqual(user.username, 'testuser')
    self.assertTrue(user.check_password('Test123456'))
```

### 2. 集成测试 (Integration Tests)

**目的**: 测试多个组件之间的交互

**包含内容**:
- API 认证流程
- 用户资料管理
- 论坛核心功能
- 用户关注系统

**命令**:
```bash
python run_comprehensive_tests.py --integration
```

**示例测试**:
```python
def test_create_post(self):
    """测试创建帖子"""
    response = self.client.post(
        '/api/forum/posts/',
        {
            'title': '测试帖子',
            'content': '内容',
            'category': self.category.id
        },
        format='json',
        **self.auth_headers(self.token)
    )
    self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

### 3. 端到端测试 (End-to-End Tests)

**目的**: 测试完整的用户流程

**包含内容**:
- 用户注册到发帖的完整流程
- 评论线程的嵌套回复
- 点赞和评论交互

**命令**:
```bash
python run_comprehensive_tests.py --e2e
```

**示例流程**:
```
注册 → 登录 → 更新资料 → 发帖 → 点赞 → 评论 → 回复
```

### 4. 性能测试 (Performance Tests)

**目的**: 测试系统在高负载下的表现

**包含内容**:
- 批量创建 50 个帖子
- 大文本处理 (10,000 字符)
- 分页功能
- 搜索性能

**命令**:
```bash
python run_comprehensive_tests.py --performance
```

### 5. 错误处理测试 (Error Handling Tests)

**目的**: 测试系统的错误处理和验证

**包含内容**:
- 无效 JSON 处理
- 缺失字段验证
- 不存在的资源访问
- HTTP 方法验证

**命令**:
```bash
python run_comprehensive_tests.py --errors
```

### 6. 并发测试 (Concurrency Tests)

**目的**: 测试并发操作的正确性

**包含内容**:
- 并发点赞
- 并发评论
- 竞态条件检查

**命令**:
```bash
python run_comprehensive_tests.py --concurrency
```

---

## 🐍 后端测试

### 完整的测试套件结构

```
backend/
├── test_suite.py              # 主要测试文件
├── run_comprehensive_tests.py # 测试运行器
├── users/
│   └── tests.py              # 用户应用测试 (可选)
├── forum/
│   └── tests.py              # 论坛应用测试 (可选)
└── models_manager/
    └── tests.py              # 模型管理器测试 (可选)
```

### 运行特定测试

```bash
# 运行单个测试类
python manage.py test test_suite.UserModelTests

# 运行单个测试方法
python manage.py test test_suite.UserModelTests.test_create_user

# 运行并显示详细输出
python manage.py test test_suite --verbosity=2

# 运行测试并停止在第一个失败处
python manage.py test test_suite --failfast

# 运行测试并显示覆盖率
coverage run --source='.' manage.py test test_suite
coverage report
coverage html  # 生成 HTML 报告
```

### 测试数据库

Django 测试会自动创建一个测试数据库，不会影响实际数据库。

```bash
# 使用特定数据库
python manage.py test test_suite --db=default

# 保留测试数据库用于调试
python manage.py test test_suite --keepdb
```

### 编写新的测试

```python
from django.test import TestCase
from rest_framework.test import APITestCase

class MyNewTests(APITestCase, UtilityMixin):
    """我的新测试"""
    
    def setUp(self):
        """设置测试前置条件"""
        self.user = self.create_test_user()
        self.token = self.get_token(self.user)
    
    def test_something(self):
        """测试某个功能"""
        response = self.client.get('/api/endpoint/')
        self.assertEqual(response.status_code, 200)
```

---

## 🌐 前端测试

### JavaScript/Node.js 端到端测试

```bash
cd /root  # 项目根目录

# 安装依赖
npm install axios

# 运行测试
node test-e2e.js

# 查看详细输出
node test-e2e.js --verbose
```

### 前端测试特点

- **基于 API**: 通过调用真实的 API 端点进行测试
- **完整流程**: 模拟真实用户交互
- **跨浏览器**: 可与 Playwright 集成进行浏览器自动化测试

### 前端测试覆盖范围

| 测试范围 | 用例数 |
|---------|-------|
| 用户认证 | 3 |
| 用户资料 | 3 |
| 论坛功能 | 8 |
| 点赞功能 | 2 |
| 评论功能 | 3 |
| 用户关注 | 3 |
| 删除功能 | 1 |
| 性能测试 | 2 |
| 错误处理 | 3 |

### 集成 Playwright 进行浏览器测试

如果需要真实浏览器自动化测试:

```bash
npm install --save-dev @playwright/test

# 创建 playwright.config.ts
# 然后编写 tests/*.spec.ts 文件
npx playwright test
```

---

## 📊 测试覆盖情况

### 后端测试覆盖

```
Users 模块:
  ✅ 用户模型 (创建、验证、关注)
  ✅ 用户认证 (注册、登录、token)
  ✅ 个人资料 (获取、更新、密码修改)
  ✅ 用户关注 (关注、取消关注)

Forum 模块:
  ✅ 分类管理 (创建、排序、查询)
  ✅ 帖子管理 (创建、读取、更新、删除)
  ✅ 评论功能 (创建、嵌套、删除)
  ✅ 点赞功能 (点赞、取消点赞)
  ✅ 标签管理 (创建、查询)

系统级:
  ✅ 错误处理 (400、401、403、404、405)
  ✅ 并发操作 (并发点赞、评论)
  ✅ 性能验证 (批量操作、大数据)
  ✅ 分页功能 (多页查询)
```

---

## 🔄 CI/CD 集成

### GitHub Actions 示例

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: aiarena_test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: 3.11
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
        pip install coverage
    
    - name: Run tests
      run: |
        cd backend
        python manage.py test test_suite --verbosity=2
    
    - name: Generate coverage
      run: |
        cd backend
        coverage run --source='.' manage.py test test_suite
        coverage xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

### 本地 Pre-commit Hook

创建 `.git/hooks/pre-commit`:

```bash
#!/bin/bash
cd backend
python manage.py test test_suite --failfast
if [ $? -ne 0 ]; then
  echo "测试失败，提交已中止"
  exit 1
fi
```

---

## 📈 测试报告

### 生成代码覆盖率报告

```bash
cd backend

# 方法1: 使用 Django 内置
python manage.py test test_suite --verbosity=2

# 方法2: 使用 coverage
pip install coverage
coverage run --source='.' manage.py test test_suite
coverage report
coverage html  # 生成 HTML 报告在 htmlcov/ 目录

# 打开 HTML 报告
open htmlcov/index.html
```

### 测试摘要输出

```bash
python run_comprehensive_tests.py --summary
```

输出示例:
```
📋 单元测试:
   - UserModelTests: 用户模型基本功能
   - UserFollowTests: 用户关注功能
   - ...

🔗 集成测试:
   - AuthenticationIntegrationTests: 用户认证流程
   - ...

✅ 通过: 156
❌ 失败: 2
🎯 通过率: 98.73%
```

### JSON 格式报告

```bash
python manage.py test test_suite --json > test_report.json
```

---

## ⚡ 最佳实践

### 1. 编写可维护的测试

```python
# ❌ 不好 - 硬编码值
def test_post(self):
    response = self.client.post('/api/forum/posts/', {'title': 'test'})

# ✅ 好 - 使用工具方法和清晰的命名
def test_create_forum_post_with_valid_data(self):
    response = self.client.post(
        '/api/forum/posts/',
        {
            'title': 'Test Post Title',
            'content': 'Test content',
            'category': self.category.id
        },
        format='json',
        **self.auth_headers(self.token)
    )
    self.assertEqual(response.status_code, status.HTTP_201_CREATED)
```

### 2. 使用 setUp 和 tearDown

```python
class MyTests(TestCase):
    def setUp(self):
        """每个测试前运行"""
        self.user = self.create_test_user()
    
    def tearDown(self):
        """每个测试后运行"""
        # 清理资源 (通常不需要，Django 自动处理)
        pass
```

### 3. 测试数据隔离

```python
# ✅ 每个测试独立使用自己的数据
class IsolatedTests(TestCase):
    def test_first(self):
        user1 = self.create_test_user('user1')
        self.assertEqual(User.objects.count(), 1)
    
    def test_second(self):
        # 此时数据库是干净的，只有新创建的用户
        user2 = self.create_test_user('user2')
        self.assertEqual(User.objects.count(), 1)
```

### 4. 使用参数化测试

```python
from parameterized import parameterized

class ParameterizedTests(TestCase):
    @parameterized.expand([
        ('user1', 'password1'),
        ('user2', 'password2'),
        ('user3', 'password3'),
    ])
    def test_login_with_different_users(self, username, password):
        # 测试多个用例
        pass
```

### 5. 模拟外部依赖

```python
from unittest.mock import patch, MagicMock

class ExternalServiceTests(TestCase):
    @patch('external_api.call_service')
    def test_with_mocked_service(self, mock_service):
        mock_service.return_value = {'status': 'success'}
        # 测试代码
        self.assertEqual(mock_service.call_count, 1)
```

### 6. 清晰的断言消息

```python
# ❌ 不清晰
self.assertTrue(user.is_active)

# ✅ 清晰
self.assertTrue(
    user.is_active,
    f"用户 {user.username} 应该是活跃的"
)
```

### 7. 测试命名约定

```python
# 格式: test_<被测试的东西>_<情况>_<期望结果>

# ✅ 好的命名
def test_create_post_with_valid_data_returns_201()
def test_create_post_without_title_returns_400()
def test_like_post_when_already_liked_returns_conflict()
def test_delete_post_by_author_removes_from_database()
```

---

## 🐛 调试测试

### 在测试中打印调试信息

```python
def test_something(self):
    import sys
    response = self.client.get('/api/endpoint/')
    print(f"Status: {response.status_code}", file=sys.stderr)
    print(f"Data: {response.data}", file=sys.stderr)
```

### 运行时添加调试信息

```bash
# 运行单个失败的测试
python manage.py test test_suite.MyTests.test_failing --verbosity=2

# 在 Python debugger 中运行
python -m pdb manage.py test test_suite.MyTests.test_failing

# 使用 pdb 在测试中设置断点
import pdb; pdb.set_trace()
```

### 保留测试数据用于调试

```bash
# 保留测试数据库以便检查
python manage.py test test_suite --keepdb

# 检查测试数据库
python manage.py dbshell --database=test_default
```

---

## 📝 常见问题

### Q: 测试运行很慢？

**A**: 尝试这些优化:
```bash
# 使用 --parallel 并行运行
python manage.py test test_suite --parallel 4

# 只运行特定的测试
python manage.py test test_suite.QuickTests

# 跳过性能测试
python run_comprehensive_tests.py --quick
```

### Q: 如何在 Docker 中运行测试？

**A**:
```bash
docker exec ai-arena-backend-1 python manage.py test test_suite --verbosity=2
```

### Q: 如何集成到 GitLab CI？

**A**: 参考 `.gitlab-ci.yml`:
```yaml
test:
  stage: test
  script:
    - cd backend
    - pip install -r requirements.txt
    - python manage.py test test_suite
```

---

## 📚 相关资源

- [Django 测试文档](https://docs.djangoproject.com/en/stable/topics/testing/)
- [Django REST Framework 测试](https://www.django-rest-framework.org/api-guide/testing/)
- [Coverage.py 文档](https://coverage.readthedocs.io/)
- [Python unittest 文档](https://docs.python.org/3/library/unittest.html)

---

**最后更新**: 2025-12-22
**维护者**: shallcheer
