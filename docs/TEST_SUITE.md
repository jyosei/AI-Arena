# AI Arena 测试套件详细文档

> **版本**: 2.0  
> **最后更新**: 2025-12-08  
> **适用范围**: 前端、后端、数据库、集成测试
> **编辑**: shallcheer

完整的测试用例、测试方法和验证流程。

---

## 📑 目录

1. [前端测试用例](#前端测试用例)
2. [后端 API 测试](#后端-api-测试)
3. [数据库测试](#数据库测试)
4. [集成测试](#集成测试)
5. [性能测试](#性能测试)
6. [测试工具和框架](#测试工具和框架)
7. [自动化测试脚本](#自动化测试脚本)


## 前端测试用例

### 1. 用户认证测试

#### 测试用例 1.1: 用户注册

**测试步骤**:
1. 打开注册页面
2. 输入有效的用户名、邮箱、密码
3. 点击注册按钮
4. 等待响应

**预期结果**:
- ✅ 弹出成功提示
- ✅ 自动跳转到登录页面
- ✅ 账户在数据库中创建

**失败场景**:
- 用户名已存在 → 显示错误提示
- 邮箱无效 → 显示验证错误
- 密码过弱 → 显示密码要求
- 网络错误 → 显示重试提示

```javascript
describe('用户注册', () => {
  it('应该成功注册新用户', async () => {
    const result = await register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Secure123!'
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('注册成功');
  });

  it('用户名已存在时应该显示错误', async () => {
    const result = await register({
      username: 'existinguser',
      email: 'new@example.com',
      password: 'Secure123!'
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('用户名已存在');
  });
});
```

#### 测试用例 1.2: 用户登录

**测试步骤**:
1. 打开登录页面
2. 输入正确的邮箱和密码
3. 点击登录按钮
4. 等待响应

**预期结果**:
- ✅ 获取 JWT Token
- ✅ 保存 Token 到 localStorage
- ✅ 跳转到主页
- ✅ 显示用户信息

**失败场景**:
- 密码错误 → 显示"密码错误"
- 账户不存在 → 显示"账户不存在"
- 账户未激活 → 显示"请激活账户"

```javascript
describe('用户登录', () => {
  it('应该成功登录', async () => {
    const result = await login({
      email: 'test@example.com',
      password: 'Secure123!'
    });
    expect(result.token).toBeDefined();
    expect(localStorage.getItem('token')).toBe(result.token);
  });

  it('密码错误时应该显示错误', async () => {
    const result = await login({
      email: 'test@example.com',
      password: 'WrongPassword'
    });
    expect(result.success).toBe(false);
  });
});
```

### 2. 论坛功能测试

#### 测试用例 2.1: 发布帖子

**测试步骤**:
1. 登录账户
2. 进入论坛
3. 点击"新建帖子"
4. 输入标题和内容
5. 选择分类和标签
6. 上传图片 (可选)
7. 点击"发布"

**预期结果**:
- ✅ 帖子发布成功
- ✅ 显示"发布成功"提示
- ✅ 帖子出现在论坛列表中
- ✅ 帖子详情页可访问
- ✅ 发布者信息正确显示

**验证点**:
- 帖子标题正确
- 帖子内容正确
- 分类和标签正确
- 发布时间正确
- 浏览数为 0
- 评论数为 0

```javascript
describe('论坛 - 发布帖子', () => {
  it('应该成功发布帖子', async () => {
    const post = {
      title: '如何学习 Python?',
      content: '我想学 Python...',
      category_id: 1,
      tags: [1, 2]
    };
    const result = await createPost(post);
    expect(result.id).toBeDefined();
    expect(result.title).toBe(post.title);
  });

  it('应该验证必填字段', async () => {
    const result = await createPost({
      title: '',
      content: 'test'
    });
    expect(result.success).toBe(false);
  });
});
```

#### 测试用例 2.2: 发表评论

**测试步骤**:
1. 打开帖子详情
2. 滚动到评论区
3. 输入评论内容
4. 点击"发表评论"

**预期结果**:
- ✅ 评论发表成功
- ✅ 评论显示在列表中
- ✅ 评论者信息正确
- ✅ 评论时间正确
- ✅ 帖子评论数增加

**测试场景**:
- 顶级评论
- 回复评论 (楼中楼)
- 评论包含链接
- 评论包含代码块
- 编辑评论
- 删除评论

```javascript
describe('论坛 - 发表评论', () => {
  it('应该成功发表顶级评论', async () => {
    const comment = {
      post_id: 1,
      content: '很好的帖子！'
    };
    const result = await createComment(comment);
    expect(result.id).toBeDefined();
    expect(result.parent_id).toBeNull();
  });

  it('应该成功发表回复评论', async () => {
    const reply = {
      post_id: 1,
      parent_id: 5,
      content: '感谢您的建议'
    };
    const result = await createComment(reply);
    expect(result.parent_id).toBe(5);
    expect(result.depth).toBe(1);
  });
});
```

#### 测试用例 2.3: 点赞和收藏

**测试步骤**:
1. 打开帖子
2. 点击点赞按钮
3. 点击收藏按钮
4. 验证数量增加

**预期结果**:
- ✅ 点赞数增加
- ✅ 收藏数增加
- ✅ 按钮状态改变 (高亮)
- ✅ 可以取消操作

```javascript
describe('论坛 - 互动', () => {
  it('应该成功点赞帖子', async () => {
    const result = await likePost(1);
    expect(result.liked).toBe(true);
    expect(result.like_count).toBeGreaterThan(0);
  });

  it('应该成功收藏帖子', async () => {
    const result = await favoritePost(1);
    expect(result.favorited).toBe(true);
  });
});
```

### 3. AI 对话测试

#### 测试用例 3.1: 创建对话

**测试步骤**:
1. 进入 AI 对话页面
2. 选择 AI 模型
3. 点击"新建对话"
4. 输入对话标题 (可选)

**预期结果**:
- ✅ 对话创建成功
- ✅ 对话列表更新
- ✅ 进入对话页面
- ✅ 输入框可用

```javascript
describe('AI 对话 - 创建对话', () => {
  it('应该成功创建对话', async () => {
    const result = await createConversation({
      model_id: 1,
      title: '学习讨论'
    });
    expect(result.id).toBeDefined();
    expect(result.messages.length).toBe(0);
  });
});
```

#### 测试用例 3.2: 发送消息

**测试步骤**:
1. 在对话中输入消息
2. 按 Enter 或点击发送按钮
3. 等待 AI 响应

**预期结果**:
- ✅ 用户消息显示
- ✅ 消息立即出现在页面
- ✅ AI 响应出现
- ✅ 对话历史保存

**测试场景**:
- 文本消息
- 包含代码的消息
- 包含公式的消息
- 包含图片的消息
- 长消息处理

```javascript
describe('AI 对话 - 发送消息', () => {
  it('应该成功发送消息并获得响应', async () => {
    const result = await sendMessage({
      conversation_id: 1,
      content: 'Python 如何使用列表?'
    });
    expect(result.user_message.id).toBeDefined();
    expect(result.ai_response.role).toBe('assistant');
  });
});
```

### 4. 页面加载测试

#### 测试用例 4.1: 首页加载

**测试步骤**:
1. 打开网站
2. 等待加载完成
3. 检查所有元素

**性能要求**:
- 首屏加载: < 2 秒
- 完全加载: < 5 秒
- 首页可交互: < 3 秒

```javascript
describe('页面加载性能', () => {
  it('首页应该在 2 秒内加载完成', async () => {
    const start = performance.now();
    await page.goto('http://82.157.56.206');
    const end = performance.now();
    expect(end - start).toBeLessThan(2000);
  });
});
```

---

## 后端 API 测试

### 1. 认证 API 测试

#### 测试用例 1.1: POST /api/users/register/

**请求**:
```bash
POST /api/users/register/
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "Secure123!"
}
```

**预期响应** (200):
```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "created_at": "2025-12-08T10:30:00Z"
}
```

**错误情况**:
- 400: 用户名已存在
- 400: 邮箱无效
- 400: 密码过弱
- 500: 服务器错误

```python
def test_user_register():
    """测试用户注册"""
    response = client.post('/api/users/register/', {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'Secure123!'
    })
    assert response.status_code == 200
    assert response.json()['username'] == 'testuser'

def test_register_duplicate_username():
    """测试用户名重复"""
    response = client.post('/api/users/register/', {
        'username': 'existinguser',
        'email': 'new@example.com',
        'password': 'Secure123!'
    })
    assert response.status_code == 400
```

#### 测试用例 1.2: POST /api/users/login/

**请求**:
```bash
POST /api/users/login/
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Secure123!"
}
```

**预期响应** (200):
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

```python
def test_user_login():
    """测试用户登录"""
    # 先创建用户
    create_test_user()
    
    # 登录
    response = client.post('/api/users/login/', {
        'email': 'test@example.com',
        'password': 'Secure123!'
    })
    assert response.status_code == 200
    assert 'access' in response.json()
    assert 'refresh' in response.json()
```

### 2. 论坛 API 测试

#### 测试用例 2.1: POST /api/posts/

**请求**:
```bash
POST /api/posts/
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "如何学习 Python?",
  "content": "我想学 Python...",
  "category_id": 1,
  "tags": [1, 2]
}
```

**预期响应** (201):
```json
{
  "id": 1,
  "title": "如何学习 Python?",
  "content": "我想学 Python...",
  "author": {
    "id": 1,
    "username": "testuser"
  },
  "category": {
    "id": 1,
    "name": "编程"
  },
  "tags": [...],
  "view_count": 0,
  "comment_count": 0,
  "created_at": "2025-12-08T10:30:00Z"
}
```

```python
@pytest.mark.django_db
def test_create_post():
    """测试创建帖子"""
    user = create_test_user()
    category = create_test_category()
    
    response = authenticated_client(user).post('/api/posts/', {
        'title': '测试帖子',
        'content': '这是一个测试帖子',
        'category_id': category.id
    })
    assert response.status_code == 201
    assert response.json()['title'] == '测试帖子'
```

#### 测试用例 2.2: GET /api/posts/

**查询参数**:
- `category_id` - 分类 ID
- `tag_id` - 标签 ID
- `search` - 搜索关键词
- `page` - 页码
- `limit` - 每页数量
- `ordering` - 排序方式 (-created_at/-view_count 等)

```python
@pytest.mark.django_db
def test_list_posts():
    """测试获取帖子列表"""
    # 创建测试数据
    create_test_posts(5)
    
    # 获取列表
    response = client.get('/api/posts/')
    assert response.status_code == 200
    assert len(response.json()['results']) <= 20

def test_list_posts_by_category():
    """测试按分类获取帖子"""
    category = create_test_category()
    create_test_posts(5, category=category)
    
    response = client.get(f'/api/posts/?category_id={category.id}')
    assert response.status_code == 200
    assert all(p['category']['id'] == category.id for p in response.json()['results'])
```

#### 测试用例 2.3: POST /api/posts/{id}/like/

**请求**:
```bash
POST /api/posts/1/like/
Authorization: Bearer {token}
```

**预期响应** (200):
```json
{
  "liked": true,
  "like_count": 5
}
```

```python
@pytest.mark.django_db
def test_like_post():
    """测试点赞帖子"""
    user = create_test_user()
    post = create_test_post()
    
    response = authenticated_client(user).post(f'/api/posts/{post.id}/like/')
    assert response.status_code == 200
    assert response.json()['liked'] == True
    assert response.json()['like_count'] == 1
```

### 3. 评论 API 测试

#### 测试用例 3.1: POST /api/posts/{id}/comments/

**请求**:
```bash
POST /api/posts/1/comments/
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "很好的帖子！",
  "parent_id": null
}
```

**预期响应** (201):
```json
{
  "id": 1,
  "content": "很好的帖子！",
  "author": {...},
  "post_id": 1,
  "parent_id": null,
  "depth": 0,
  "created_at": "2025-12-08T10:30:00Z"
}
```

```python
@pytest.mark.django_db
def test_create_comment():
    """测试创建评论"""
    user = create_test_user()
    post = create_test_post()
    
    response = authenticated_client(user).post(
        f'/api/posts/{post.id}/comments/',
        {'content': '很好的评论'}
    )
    assert response.status_code == 201
    assert response.json()['content'] == '很好的评论'

def test_create_reply_comment():
    """测试创建回复评论"""
    user = create_test_user()
    post = create_test_post()
    parent_comment = create_test_comment(post)
    
    response = authenticated_client(user).post(
        f'/api/posts/{post.id}/comments/',
        {
            'content': '感谢您的评论',
            'parent_id': parent_comment.id
        }
    )
    assert response.status_code == 201
    assert response.json()['parent_id'] == parent_comment.id
    assert response.json()['depth'] == 1
```

### 4. AI 对话 API 测试

#### 测试用例 4.1: POST /api/conversations/

**请求**:
```bash
POST /api/conversations/
Authorization: Bearer {token}
Content-Type: application/json

{
  "model_id": 1,
  "title": "Python 学习"
}
```

**预期响应** (201):
```json
{
  "id": 1,
  "model_id": 1,
  "title": "Python 学习",
  "mode": "direct-chat",
  "created_at": "2025-12-08T10:30:00Z",
  "messages": []
}
```

```python
@pytest.mark.django_db
def test_create_conversation():
    """测试创建对话"""
    user = create_test_user()
    model = create_test_model()
    
    response = authenticated_client(user).post(
        '/api/conversations/',
        {
            'model_id': model.id,
            'title': '测试对话'
        }
    )
    assert response.status_code == 201
    assert response.json()['title'] == '测试对话'
```

#### 测试用例 4.2: POST /api/conversations/{id}/messages/

**请求**:
```bash
POST /api/conversations/1/messages/
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "如何使用 Python 列表?"
}
```

**预期响应** (201):
```json
{
  "user_message": {
    "id": 1,
    "role": "user",
    "content": "如何使用 Python 列表?"
  },
  "ai_response": {
    "id": 2,
    "role": "assistant",
    "content": "Python 列表是一种有序的集合..."
  }
}
```

```python
@pytest.mark.django_db
def test_send_message():
    """测试发送消息"""
    user = create_test_user()
    conversation = create_test_conversation(user)
    
    response = authenticated_client(user).post(
        f'/api/conversations/{conversation.id}/messages/',
        {'content': 'Hello, how are you?'}
    )
    assert response.status_code == 201
    assert 'user_message' in response.json()
    assert 'ai_response' in response.json()
```

### 5. 排行榜 API 测试

#### 测试用例 5.1: GET /api/leaderboard/

**预期响应** (200):
```json
{
  "results": [
    {
      "rank": 1,
      "model_id": 1,
      "model_name": "GPT-4-Turbo",
      "elo_rating": 2450,
      "wins": 145,
      "losses": 32,
      "draw_rate": 0.0432
    },
    ...
  ],
  "count": 42,
  "next": null,
  "previous": null
}
```

```python
@pytest.mark.django_db
def test_leaderboard():
    """测试获取排行榜"""
    # 创建测试模型
    create_test_models(5)
    
    response = client.get('/api/leaderboard/')
    assert response.status_code == 200
    results = response.json()['results']
    
    # 验证排序
    for i in range(len(results) - 1):
        assert results[i]['elo_rating'] >= results[i+1]['elo_rating']
```

### 6. 性能测试

#### 测试用例 6.1: API 响应时间

```python
import time

@pytest.mark.django_db
def test_api_response_time():
    """测试 API 响应时间"""
    create_test_posts(100)
    
    start = time.time()
    response = client.get('/api/posts/')
    end = time.time()
    
    assert (end - start) < 0.5  # 应该在 500ms 内
    assert response.status_code == 200
```

---

## 数据库测试

### 1. 表结构测试

#### 测试用例 1.1: 验证表存在

```python
from django.db import connection

@pytest.mark.django_db
def test_tables_exist():
    """验证所有必要表存在"""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'aiarena'"
        )
        tables = {row[0] for row in cursor.fetchall()}
        
        required_tables = {
            'users_user',
            'forum_forumpost',
            'forum_forumcomment',
            'models_manager_chatmessage',
            'models_manager_leaderboardsnapshot',
            'models_manager_modeltestresult'
        }
        
        assert required_tables.issubset(tables)
```

#### 测试用例 1.2: 验证索引

```python
@pytest.mark.django_db
def test_indexes_exist():
    """验证关键索引存在"""
    with connection.cursor() as cursor:
        # 检查 forum_forumpost 的索引
        cursor.execute("""
            SELECT INDEX_NAME FROM information_schema.STATISTICS
            WHERE TABLE_NAME = 'forum_forumpost'
            AND TABLE_SCHEMA = 'aiarena'
        """)
        indexes = {row[0] for row in cursor.fetchall()}
        
        expected_indexes = {
            'PRIMARY',
            'idx_author_created',
            'idx_category_created',
            'idx_last_activity'
        }
        
        assert expected_indexes.issubset(indexes)
```

### 2. 数据完整性测试

#### 测试用例 2.1: 验证外键约束

```python
@pytest.mark.django_db
def test_foreign_key_constraint():
    """测试外键约束"""
    from forum.models import ForumPost
    from users.models import User
    
    # 创建用户
    user = User.objects.create(username='test')
    
    # 创建帖子关联用户
    post = ForumPost.objects.create(
        title='Test',
        content='Test content',
        author=user
    )
    
    # 验证关联
    assert post.author_id == user.id
    assert post.author.username == 'test'
```

#### 测试用例 2.2: 验证唯一约束

```python
@pytest.mark.django_db
def test_unique_constraint():
    """测试唯一约束"""
    from forum.models import ForumPostFavorite
    
    user = create_test_user()
    post = create_test_post()
    
    # 创建第一个收藏
    ForumPostFavorite.objects.create(post=post, user=user)
    
    # 尝试创建重复收藏
    with pytest.raises(IntegrityError):
        ForumPostFavorite.objects.create(post=post, user=user)
```

### 3. 查询性能测试

#### 测试用例 3.1: 索引查询性能

```python
import time

@pytest.mark.django_db
def test_indexed_query_performance():
    """测试索引查询性能"""
    from forum.models import ForumPost
    
    user = create_test_user()
    
    # 创建大量帖子
    for i in range(1000):
        ForumPost.objects.create(
            title=f'Post {i}',
            content='Content',
            author=user
        )
    
    # 使用索引查询
    start = time.time()
    posts = list(ForumPost.objects.filter(author=user).order_by('-created_at')[:20])
    end = time.time()
    
    assert (end - start) < 0.1  # 应该在 100ms 内
    assert len(posts) == 20
```

### 4. 新表测试

#### 测试用例 4.1: ModelTestResult

```python
@pytest.mark.django_db
def test_model_test_result():
    """测试 ModelTestResult 表"""
    from models_manager.models import ModelTestResult, AIModel
    
    model = AIModel.objects.create(name='Test Model')
    user = create_test_user()
    
    # 创建测试结果
    test_result = ModelTestResult.objects.create(
        model=model,
        test_type='accuracy',
        test_name='ImageNet Test',
        score=94.5,
        metrics={'precision': 0.945, 'recall': 0.942},
        status='passed',
        created_by=user
    )
    
    # 验证字段
    assert test_result.model_id == model.id
    assert test_result.score == 94.5
    assert test_result.status == 'passed'
```

#### 测试用例 4.2: LeaderboardSnapshot

```python
@pytest.mark.django_db
def test_leaderboard_snapshot():
    """测试 LeaderboardSnapshot 表"""
    from models_manager.models import LeaderboardSnapshot
    
    leaderboard_data = [
        {
            'rank': 1,
            'model_id': 1,
            'elo_rating': 2450,
            'wins': 145
        }
    ]
    
    snapshot = LeaderboardSnapshot.objects.create(
        total_models=1,
        total_battles=145,
        leaderboard_data=leaderboard_data
    )
    
    assert snapshot.total_models == 1
    assert snapshot.leaderboard_data[0]['rank'] == 1
```

---

## 集成测试

### 1. 用户注册到发帖流程

```python
@pytest.mark.django_db
def test_user_registration_to_posting_flow():
    """完整的用户注册到发帖流程"""
    # 1. 注册用户
    response = client.post('/api/users/register/', {
        'username': 'newuser',
        'email': 'new@example.com',
        'password': 'Secure123!'
    })
    assert response.status_code == 200
    user_id = response.json()['id']
    
    # 2. 登录
    response = client.post('/api/users/login/', {
        'email': 'new@example.com',
        'password': 'Secure123!'
    })
    assert response.status_code == 200
    token = response.json()['access']
    
    # 3. 发布帖子
    client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    response = client.post('/api/posts/', {
        'title': 'First Post',
        'content': 'This is my first post'
    })
    assert response.status_code == 201
    post_id = response.json()['id']
    
    # 4. 验证帖子
    response = client.get(f'/api/posts/{post_id}/')
    assert response.status_code == 200
    assert response.json()['author']['id'] == user_id
```

### 2. 对话和对战集成测试

```python
@pytest.mark.django_db
def test_conversation_and_battle_flow():
    """对话和对战集成测试"""
    user = create_test_user()
    model1 = create_test_model(name='GPT-4')
    model2 = create_test_model(name='Claude')
    
    # 1. 创建对话
    response = authenticated_client(user).post(
        '/api/conversations/',
        {'model_id': model1.id}
    )
    assert response.status_code == 201
    conversation_id = response.json()['id']
    
    # 2. 发送消息
    response = authenticated_client(user).post(
        f'/api/conversations/{conversation_id}/messages/',
        {'content': 'Explain quantum computing'}
    )
    assert response.status_code == 201
    
    # 3. 发起对战
    response = authenticated_client(user).post(
        '/api/battles/',
        {
            'model_a_id': model1.id,
            'model_b_id': model2.id,
            'prompt': 'Explain quantum computing'
        }
    )
    assert response.status_code == 201
    battle_id = response.json()['id']
    
    # 4. 投票
    response = authenticated_client(user).post(
        f'/api/battles/{battle_id}/vote/',
        {'winner': model1.id}
    )
    assert response.status_code == 200
```

---

## 性能测试

### 1. 负载测试

```python
import concurrent.futures

@pytest.mark.django_db
def test_concurrent_requests():
    """测试并发请求"""
    create_test_posts(100)
    
    def make_request():
        response = client.get('/api/posts/')
        return response.status_code == 200
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_request) for _ in range(100)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    assert all(results)
    assert len(results) == 100
```

### 2. 数据库查询优化测试

```python
from django.test.utils import override_settings
from django.db import connection
from django.test import TransactionTestCase

@override_settings(DEBUG=True)
class QueryOptimizationTest(TransactionTestCase):
    def test_post_list_query_count(self):
        """测试查询数量是否优化"""
        create_test_posts(20)
        
        connection.queries_log.clear()
        
        # 使用 select_related 和 prefetch_related 优化
        posts = list(ForumPost.objects.select_related(
            'author',
            'category'
        ).prefetch_related('tags'))
        
        # 应该只有 3-4 次查询
        query_count = len(connection.queries)
        assert query_count < 5
```

---

## 测试工具和框架

### 1. 前端测试工具

**推荐工具**:
- Jest - 单元测试
- React Testing Library - 组件测试
- Cypress - E2E 测试
- Playwright - 浏览器自动化

**命令**:
```bash
# 运行 Jest 测试
npm test

# 运行 Cypress E2E 测试
npx cypress open

# 生成覆盖率报告
npm run test:coverage
```

### 2. 后端测试工具

**推荐工具**:
- pytest - 测试框架
- pytest-django - Django 支持
- pytest-cov - 覆盖率
- factory_boy - 测试数据工厂
- faker - 假数据生成

**命令**:
```bash
# 运行所有测试
python manage.py test

# 运行特定测试
pytest tests/test_users.py

# 生成覆盖率报告
pytest --cov=.

# 并行运行测试
pytest -n auto
```

### 3. API 测试工具

- Postman - API 测试
- REST Client (VS Code 插件) - 快速测试
- Thunder Client - 轻量级客户端

### 4. 性能测试工具

- Apache JMeter - 负载测试
- Locust - Python 负载测试
- Artillery - 现代化负载测试

### 5. 测试覆盖率目标

| 组件 | 覆盖率目标 |
|------|----------|
| API 端点 | ≥ 90% |
| 业务逻辑 | ≥ 85% |
| 数据库模型 | ≥ 80% |
| 前端组件 | ≥ 70% |
| 集成测试 | ≥ 80% |

---

## CI/CD 测试配置

### GitHub Actions 示例

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: 3.11
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run tests
        run: pytest --cov=.
```
---

**版本**: 2.0  
**最后更新**: 2025-12-08  
**测试覆盖**: 前端/后端/数据库/集成  

---

## 自动化测试脚本

### 脚本概述

项目提供了两个自动化测试脚本，用于快速运行完整的测试套件：

- **Linux/macOS**: `scripts/run-tests.sh`
- **Windows**: `scripts/run-tests.bat`

这些脚本能够自动化运行所有测试，包括单元测试、集成测试、数据库检查和代码风格检查。

### 使用方法

#### Linux/macOS 用户

**1. 赋予脚本执行权限**:
```bash
chmod +x scripts/run-tests.sh
```

**2. 运行测试**:
```bash
# 运行所有测试
./scripts/run-tests.sh 全部

# 运行特定类型的测试
./scripts/run-tests.sh 后端      # 只运行后端测试
./scripts/run-tests.sh 前端      # 只运行前端测试
./scripts/run-tests.sh 数据库    # 只运行数据库测试
./scripts/run-tests.sh API       # 只运行 API 集成测试
./scripts/run-tests.sh Docker    # 只检查 Docker 容器
./scripts/run-tests.sh 性能      # 只运行性能测试
```

#### Windows 用户

**1. 运行测试**:
```cmd
REM 运行所有测试
scripts\run-tests.bat all

REM 运行特定类型的测试
scripts\run-tests.bat backend      REM 只运行后端测试
scripts\run-tests.bat frontend     REM 只运行前端测试
scripts\run-tests.bat database     REM 只运行数据库测试
scripts\run-tests.bat api          REM 只运行 API 集成测试
scripts\run-tests.bat docker       REM 只检查 Docker 容器
scripts\run-tests.bat performance  REM 只运行性能测试
```

### 脚本功能说明

#### 后端测试 (backend)

运行以下操作：

1. **数据库迁移** - 应用所有待处理的数据库迁移
2. **Django 单元测试** - 运行 Django 内置测试框架的测试
3. **pytest 测试** - 运行 pytest 单元测试 (如果配置了)
4. **数据库健康检查** - 验证数据库表、索引和外键
5. **代码风格检查** - 使用 flake8 检查 Python 代码风格

**依赖**:
- Python 3.8+
- Django 5.1
- pytest (可选)
- flake8 (可选)

**示例输出**:
```
========================================
运行后端测试
========================================

[INFO] 运行数据库迁移...
[OK] 数据库迁移完成
[INFO] 运行单元测试...
[OK] Django 单元测试通过
[INFO] 运行数据库健康检查...
[OK] 数据库健康检查通过
```

#### 前端测试 (frontend)

运行以下操作：

1. **npm 依赖安装** - 如果 node_modules 不存在，自动安装
2. **Jest 单元测试** - 运行 React 组件单元测试
3. **ESLint 代码检查** - 检查代码风格和最佳实践
4. **生产构建** - 运行 Vite 生产构建，验证可构建性

**依赖**:
- Node.js 16+
- npm 8+

**示例输出**:
```
========================================
运行前端测试
========================================

[INFO] 安装 npm 依赖...
[INFO] 运行 Jest 单元测试...
[OK] Jest 单元测试通过
[INFO] 运行 ESLint 代码检查...
[OK] ESLint 代码检查通过
[INFO] 运行生产构建检查...
[OK] 生产构建成功
```

#### 数据库测试 (database)

运行以下操作：

1. **数据库连接测试** - 验证 MySQL 连接
2. **表和索引验证** - 确保所有关键表和索引存在
3. **外键约束验证** - 验证数据完整性约束
4. **数据库健康检查** - 运行完整的数据库检查脚本

**示例输出**:
```
========================================
运行数据库测试
========================================

[INFO] 检查 MySQL 数据库连接...
[OK] MySQL 连接成功
[INFO] 运行数据库完整性检查...
[OK] 数据库完整性检查通过
```

#### API 集成测试 (api)

运行以下操作：

1. **API 服务检查** - 验证后端 API 服务是否在运行
2. **Postman 集合测试** - 运行 Postman 自动化测试 (如果配置了)

**前置条件**:
- 后端 API 服务运行在 http://82.157.56.206

#### Docker 测试 (docker)

运行以下操作：

1. **容器状态检查** - 检查各容器是否运行
   - ai-arena-backend
   - ai-arena-frontend
   - ai-arena-db

**示例输出**:
```
========================================
运行 Docker 环境测试
========================================

[INFO] 检查容器状态...
[OK] 后端容器运行中
[OK] 前端容器运行中
[OK] 数据库容器运行中
```

#### 性能测试 (性能)

运行以下操作：

1. **数据库查询性能** - 测试 100 条帖子查询的响应时间
   - < 500ms: ✓ 性能良好
   - ≥ 500ms: ⚠ 性能一般

### 脚本配置

#### 修改超时时间

编辑脚本中的常数 (Linux/macOS):

```bash
# run-tests.sh 中
TIMEOUT_SECONDS=30  # 修改超时时间为 30 秒
```

#### 自定义测试路径

```bash
# 修改后端测试目录
BACKEND_TESTS_DIR="$PROJECT_ROOT/backend/tests"

# 修改前端测试目录
FRONTEND_TESTS_DIR="$PROJECT_ROOT/frontend/tests"
```

### CI/CD 集成

#### GitHub Actions 集成

创建 `.github/workflows/test.yml`:

```yaml
name: Automated Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_DATABASE: aiarena
          MYSQL_ROOT_PASSWORD: password
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.11
      
      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: 18
      
      - name: Run tests
        run: bash scripts/run-tests.sh 全部
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

#### GitLab CI 集成

创建 `.gitlab-ci.yml`:

```yaml
test:
  image: ubuntu:22.04
  script:
    - apt-get update && apt-get install -y python3 python3-pip nodejs npm mysql-client
    - bash scripts/run-tests.sh 全部
  artifacts:
    paths:
      - coverage/
```

### 故障排除

#### 脚本权限错误 (Linux/macOS)

```bash
# 错误
bash: ./scripts/run-tests.sh: Permission denied

# 解决
chmod +x scripts/run-tests.sh
bash scripts/run-tests.sh 全部
```

#### Python 或 npm 未找到

```bash
# 检查 Python
python3 --version

# 检查 npm
npm --version

# 如果未安装，请先安装对应的运行时
```

#### 数据库连接失败

```bash
# 检查 MySQL 是否运行
ps aux | grep mysql

# 检查数据库凭证 (.env 文件)
cat backend/.env | grep DATABASE

# 尝试手动连接
mysql -u root -p -h 127.0.0.1 aiarena
```

### 日志和报告

#### 查看详细日志

```bash
# Linux/macOS: 重定向输出到文件
./scripts/run-tests.sh 全部 | tee test-results.log

# Windows: 重定向输出到文件
scripts\run-tests.bat all > test-results.log 2>&1
```

#### 生成覆盖率报告

后端覆盖率报告生成在: `backend/htmlcov/index.html`

```bash
# 查看覆盖率报告
open backend/htmlcov/index.html  # macOS
xdg-open backend/htmlcov/index.html  # Linux
start backend\htmlcov\index.html  # Windows
```

### 测试结果解释

#### 成功的测试输出

```
========================================
测试总结报告
========================================

通过: 52
失败: 0

✓ 所有测试通过！
```

#### 失败的测试输出

```
========================================
测试总结报告
========================================

通过: 48
失败: 4

✗ 存在测试失败
```

**常见失败原因**:
1. 数据库未运行或连接失败
2. 某个依赖未安装
3. 某个外部服务不可用
4. 环境变量配置不正确

### 定期测试计划

建议设置以下测试计划：

| 时间 | 测试类型 | 频率 |
|------|--------|------|
| 每次提交 | 后端 + 前端 | 自动 |
| 每小时 | 全部 | CI/CD |
| 每天 | 全部 + 性能 | 夜间 |
| 每周 | 全部 + 压力测试 | 周末 |

**设置定时任务** (Linux):

```bash
# 编辑 crontab
crontab -e

# 每天晚上 10 点运行完整测试
0 22 * * * cd /path/to/AI-Arena && bash scripts/run-tests.sh 全部 >> logs/test.log 2>&1
```

---

**版本**: 2.0  
**最后更新**: 2025-12-08  
**测试覆盖**: 前端/后端/数据库/集成/自动化  
**项目状态**: ✅ TESTING COMPLETE
**项目状态**: ✅ READY FOR PRODUCTION
