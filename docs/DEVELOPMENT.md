# AI Arena 开发指南

> **版本**: 2.0  
> **最后更新**: 2025-12-08  
> **目标用户**: 后端开发者、前端开发者、DevOps  
> **编辑**: shallcheer

完整的开发流程、环境配置、编码规范和故障排除指南。

---

## 📑 目录

1. [快速开始](#快速开始)
2. [开发环境配置](#开发环境配置)
3. [项目结构](#项目结构)
4. [编码规范](#编码规范)
5. [常见任务](#常见任务)
6. [故障排除](#故障排除)
7. [性能优化](#性能优化)

---

## 快速开始

### 使用 Docker Compose (推荐)

**前置条件**:
- Docker Desktop 已安装
- Docker Compose 已安装

**快速启动** (3 个命令):

```bash
# 1. 克隆项目
git clone https://github.com/your-org/AI-Arena.git
cd AI-Arena

# 2. 构建镜像并启动
docker compose up -d

# 3. 初始化数据库
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

**访问应用**:
- 前端: http://82.157.56.206
- 后端 API: http://82.157.56.206
- Admin: http://82.157.56.206/admin
- 数据库: localhost:3306

### 本地开发 (不用 Docker)

**后端**:
```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate      # Windows

# 安装依赖
pip install -r requirements.txt

# 运行迁移
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser

# 启动开发服务器
python manage.py runserver 0.0.0.0:8000
```

**前端**:
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

---

## 开发环境配置

### 1. Python 后端环境

#### 环境变量配置

创建 `backend/.env`:

```bash
# Django 设置
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=82.157.56.206,127.0.0.1,0.0.0.0

# 数据库
DATABASE_ENGINE=django.db.backends.mysql
DATABASE_NAME=aiarena
DATABASE_USER=root
DATABASE_PASSWORD=password
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306

# 认证
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256

# OAuth 设置
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
WECHAT_APPID=your-wechat-appid
WECHAT_SECRET=your-wechat-secret

# AI 模型 API
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# CORS
CORS_ALLOWED_ORIGINS=http://82.157.56.206,http://localhost:5173
```

#### 依赖安装

```bash
cd backend
pip install -r requirements.txt
```

**主要依赖**:
```
Django==5.1
djangorestframework==3.14
django-cors-headers==4.3
PyJWT==2.8
python-dotenv==1.0
mysql-connector-python==8.2
```

#### 数据库初始化

```bash
# 执行迁移
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser

# 加载初始数据 (可选)
python manage.py loaddata initial_data

# 运行健康检查
python database_health_check.py
```

### 2. Node.js 前端环境

#### 环境变量配置

创建 `frontend/.env`:

```bash
# API 地址
VITE_API_BASE_URL=http://82.157.56.206/api

# 应用信息
VITE_APP_NAME=AI Arena
VITE_APP_VERSION=1.0.0

# 功能开关
VITE_ENABLE_GITHUB_OAUTH=true
VITE_ENABLE_WECHAT_OAUTH=true

# 调试模式
VITE_DEBUG_MODE=true
```

#### 依赖安装

```bash
cd frontend
npm install
```

**主要依赖**:
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.0",
  "axios": "^1.6",
  "antd": "^5.0"
}
```

#### 开发服务器

```bash
# 启动 Vite 开发服务器 (支持热模块替换)
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

### 3. 数据库配置

#### MySQL 本地启动

```bash
# 使用 Docker
docker run --name mysql8 \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=aiarena \
  -p 3306:3306 \
  -d mysql:8.0

# 或使用 Homebrew (macOS)
brew install mysql
brew services start mysql
mysql_secure_installation

# 创建数据库
mysql -u root -p
CREATE DATABASE aiarena CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'aiarena'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON aiarena.* TO 'aiarena'@'%';
FLUSH PRIVILEGES;
```

#### 数据库连接测试

```bash
# 测试连接
python manage.py dbshell

# 运行迁移
python manage.py migrate

# 检查表
python database_health_check.py
```

---

## 项目结构

### 后端项目结构详解

```
backend/
├── ai_arena_backend/              # 项目配置
│   ├── settings.py               # ← 最常修改
│   │   ├── INSTALLED_APPS       # 应用注册
│   │   ├── DATABASES            # 数据库配置
│   │   ├── REST_FRAMEWORK       # DRF 配置
│   │   ├── JWT 认证配置
│   │   └── CORS 配置
│   ├── urls.py                  # ← 路由配置
│   │   └── path('api/', include(...))
│   ├── asgi.py                  # 异步入口
│   └── wsgi.py                  # WSGI 入口
│
├── users/
│   ├── models.py                # ← 数据模型
│   │   └── class User
│   ├── serializers.py           # ← 数据序列化
│   │   ├── UserSerializer
│   │   ├── RegisterSerializer
│   │   └── LoginSerializer
│   ├── views.py                 # ← 视图/API
│   │   ├── RegisterView
│   │   ├── LoginView
│   │   └── UserProfileView
│   ├── permissions.py           # 权限类
│   │   └── IsUser (自定义权限)
│   ├── urls.py                  # 路由注册
│   │   └── path('register', ...)
│   ├── tests.py                 # 单元测试
│   └── migrations/              # 数据库迁移
│
├── forum/                        # 论坛模块 (类似结构)
│   ├── models.py                # ForumPost, ForumComment, etc
│   ├── serializers.py
│   ├── views.py                 # ViewSet (ModelViewSet)
│   ├── permissions.py
│   ├── urls.py
│   └── tests.py
│
├── models_manager/              # 模型管理模块
│   ├── models.py                # AIModel, Battle, etc
│   ├── services.py              # ← 业务逻辑
│   │   ├── class BattleService
│   │   ├── class RankingService
│   │   └── class TestResultService
│   ├── views.py                 # ViewSet
│   ├── urls.py
│   └── tests.py
│
├── chat/                         # 对话模块
│   ├── models.py                # ChatConversation, ChatMessage
│   ├── views.py
│   └── tests.py
│
├── manage.py                    # Django 管理命令
├── requirements.txt             # ← 依赖列表 (修改后需重新安装)
├── Dockerfile                   # Docker 配置
├── .env.example                 # 环境变量模板
└── database_health_check.py     # 数据库检查脚本
```

### 前端项目结构详解

```
frontend/
├── src/
│   ├── main.jsx                 # ← 应用入口
│   │   └── ReactDOM.createRoot
│   ├── App.jsx                  # ← 根组件
│   │   └── <Outlet>
│   ├── global.css               # 全局样式
│   │
│   ├── api/                     # API 层
│   │   ├── apiClient.js         # ← Axios 配置
│   │   │   └── export const apiClient
│   │   ├── forum.js             # ← API 调用
│   │   │   ├── export const getForumPosts
│   │   │   ├── export const createPost
│   │   │   └── ...
│   │   ├── auth.js
│   │   ├── models.js
│   │   └── chat.js
│   │
│   ├── components/              # 可复用组件
│   │   ├── Header.jsx           # 页头
│   │   ├── Footer.jsx           # 页脚
│   │   ├── Sidebar.jsx          # 侧边栏
│   │   ├── Loading.jsx          # 加载组件
│   │   ├── PostCard.jsx         # 帖子卡片
│   │   └── CommentList.jsx      # 评论列表
│   │
│   ├── contexts/                # 状态管理
│   │   ├── AuthContext.jsx      # ← 认证状态
│   │   │   └── export const useAuth
│   │   ├── AppContext.jsx       # 应用全局状态
│   │   └── ThemeContext.jsx     # 主题切换
│   │
│   ├── pages/                   # 页面组件 (路由级别)
│   │   ├── Home.jsx             # 首页
│   │   ├── Forum/
│   │   │   ├── ForumPage.jsx    # 论坛首页
│   │   │   ├── PostDetail.jsx   # 帖子详情
│   │   │   └── CreatePost.jsx   # 创建帖子
│   │   ├── Chat/
│   │   │   └── ChatPage.jsx     # 对话页面
│   │   ├── Models/
│   │   │   ├── Leaderboard.jsx  # 排行榜
│   │   │   └── BattleArena.jsx  # 对战竞技场
│   │   ├── Auth/
│   │   │   ├── Login.jsx        # 登录页面
│   │   │   └── Register.jsx     # 注册页面
│   │   └── Profile/
│   │       └── ProfilePage.jsx  # 用户资料
│   │
│   ├── services/                # 业务逻辑
│   │   ├── authService.js       # ← 认证逻辑
│   │   │   ├── export const login
│   │   │   ├── export const register
│   │   │   └── export const logout
│   │   ├── forumService.js      # 论坛业务逻辑
│   │   └── modelService.js      # 模型业务逻辑
│   │
│   └── utils/                   # 工具函数
│       ├── helpers.js           # 辅助函数
│       ├── validators.js        # 验证函数
│       ├── formatters.js        # 格式化函数
│       └── storage.js           # 本地存储操作
│
├── public/                      # 静态资源
│   └── test.html
├── package.json                 # ← 依赖配置
├── vite.config.js              # ← Vite 配置
├── .env.example                # 环境变量模板
└── nginx.conf                  # Nginx 配置
```

---

## 编码规范

### Python 后端规范

#### 文件和命名

```python
# ✅ 正确的命名
class ForumPost:          # 类名: PascalCase
    def __init__(self):
        self.title = ""   # 属性名: snake_case
    
    def get_comments(self):  # 方法名: snake_case
        pass

# ❌ 错误的命名
class forum_post:         # 类名应该 PascalCase
    def __init__(self):
        self.Post_Title = ""  # 属性名应该 snake_case
    
    def GetComments(self):    # 方法名应该 snake_case
        pass
```

#### 模型编写

```python
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """用户模型 - 继承 Django 内置用户"""
    
    # 基本字段 (继承自 AbstractUser)
    # username, email, password, first_name, last_name, is_active, etc
    
    # 自定义字段
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    github_id = models.CharField(max_length=50, unique=True, null=True)
    
    # 时间戳 (常用)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # 元数据
    class Meta:
        ordering = ['-created_at']  # 默认排序
        indexes = [
            models.Index(fields=['created_at']),
        ]
    
    # 字符串表示
    def __str__(self):
        return self.username
    
    # 自定义方法
    def get_profile_url(self):
        return f"/profile/{self.id}/"
```

#### ViewSet 编写

```python
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

class ForumPostViewSet(viewsets.ModelViewSet):
    """论坛帖子 ViewSet"""
    
    # 1. 数据集和序列化器
    queryset = ForumPost.objects.all().select_related('author', 'category')
    serializer_class = ForumPostSerializer
    
    # 2. 权限和认证
    permission_classes = [IsAuthenticatedOrReadOnly]  # 认证或只读
    
    # 3. 过滤和搜索
    filterset_fields = ['category_id', 'status']
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'view_count']
    ordering = ['-created_at']  # 默认排序
    
    # 4. 分页
    pagination_class = StandardResultsSetPagination
    
    # 5. 标准方法 (自动实现)
    # list(), create(), retrieve(), update(), destroy()
    
    # 6. 自定义方法
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        """点赞帖子"""
        post = self.get_object()
        # 逻辑实现
        return Response({'status': 'success'})
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """获取热门帖子"""
        popular_posts = self.get_queryset().order_by('-view_count')[:10]
        serializer = self.get_serializer(popular_posts, many=True)
        return Response(serializer.data)
    
    # 7. 覆盖标准方法
    def perform_create(self, serializer):
        """创建帖子时自动关联当前用户"""
        serializer.save(author=self.request.user)
```

#### 序列化器编写

```python
from rest_framework import serializers
from forum.models import ForumPost

class ForumPostSerializer(serializers.ModelSerializer):
    """论坛帖子序列化器"""
    
    # 关联字段
    author = UserSerializer(read_only=True)  # 嵌套序列化
    category = serializers.StringRelatedField(read_only=True)
    tags = serializers.SerializerMethodField()  # 自定义字段
    
    # 字段重命名
    view_count = serializers.IntegerField(read_only=True)
    like_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ForumPost
        fields = ['id', 'title', 'content', 'author', 'category', 'tags', 
                 'view_count', 'like_count', 'created_at']
        read_only_fields = ['id', 'created_at', 'view_count']
    
    def get_tags(self, obj):
        """获取标签列表"""
        return [tag.name for tag in obj.tags.all()]
    
    def get_like_count(self, obj):
        """获取点赞数"""
        return obj.postlike_set.count()
    
    def validate_title(self, value):
        """验证标题"""
        if len(value) < 5:
            raise serializers.ValidationError("标题至少需要 5 个字符")
        return value
```

#### 服务类编写

```python
from django.db import transaction

class BattleService:
    """对战业务逻辑服务"""
    
    @staticmethod
    @transaction.atomic  # 事务保护
    def create_battle(model_a, model_b, prompt, creator):
        """创建新对战"""
        # 数据验证
        if model_a == model_b:
            raise ValueError("不能选择同一个模型进行对战")
        
        # 创建对战
        battle = Battle.objects.create(
            model_a=model_a,
            model_b=model_b,
            prompt=prompt,
            creator=creator
        )
        
        # 获取 AI 响应 (异步)
        # 调用 AI API
        response_a = call_ai_model(model_a, prompt)
        response_b = call_ai_model(model_b, prompt)
        
        # 保存响应
        battle.response_a = response_a
        battle.response_b = response_b
        battle.save()
        
        return battle
    
    @staticmethod
    def vote_winner(battle, voter, winner_id):
        """投票对战胜者"""
        # 验证投票
        if winner_id not in [battle.model_a_id, battle.model_b_id]:
            raise ValueError("无效的模型 ID")
        
        # 保存投票
        vote = BattleVote.objects.create(
            battle=battle,
            voter=voter,
            winner_id=winner_id
        )
        
        # 更新 ELO 等级
        update_elo_rating(battle, winner_id)
        
        return vote
```

### JavaScript 前端规范

#### 组件编写

```jsx
// ✅ 正确的组件结构
import React, { useState, useEffect } from 'react';
import { Button, Card } from 'antd';
import './PostCard.css';

/**
 * 帖子卡片组件
 * @param {object} post - 帖子数据
 * @param {function} onLike - 点赞回调
 * @param {function} onDelete - 删除回调
 */
const PostCard = ({ post, onLike, onDelete }) => {
  // 1. 状态管理
  const [isLiking, setIsLiking] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(post.like_count);
  
  // 2. 副作用
  useEffect(() => {
    // 组件挂载逻辑
    return () => {
      // 组件卸载逻辑
    };
  }, [post.id]); // 依赖数组
  
  // 3. 事件处理器
  const handleLike = async () => {
    setIsLiking(true);
    try {
      await onLike(post.id);
      setLocalLikeCount(prev => prev + 1);
    } catch (error) {
      console.error('点赞失败:', error);
    } finally {
      setIsLiking(false);
    }
  };
  
  const handleDelete = async () => {
    if (window.confirm('确定要删除吗?')) {
      await onDelete(post.id);
    }
  };
  
  // 4. 渲染
  return (
    <Card className="post-card" hoverable>
      <div className="post-header">
        <h3>{post.title}</h3>
        <span className="category">{post.category}</span>
      </div>
      
      <div className="post-content">
        {post.content}
      </div>
      
      <div className="post-footer">
        <span>作者: {post.author.username}</span>
        <span>浏览: {post.view_count}</span>
        <Button 
          type="primary" 
          onClick={handleLike}
          loading={isLiking}
        >
          ❤ {localLikeCount}
        </Button>
        <Button 
          danger 
          onClick={handleDelete}
        >
          删除
        </Button>
      </div>
    </Card>
  );
};

export default PostCard;
```

#### Hook 自定义

```jsx
// ✅ 自定义 Hook 示例
import { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';

/**
 * 获取帖子数据的 Hook
 * @param {number} postId - 帖子 ID
 * @returns {object} { data, loading, error }
 */
const usePost = (postId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/posts/${postId}/`);
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPost();
  }, [postId]);
  
  return { data, loading, error };
};

export default usePost;
```

#### API 调用

```javascript
// ✅ 标准的 API 调用
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.VITE_API_BASE_URL || 'http://82.157.56.206/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 请求拦截器 - 添加认证 Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期，清除并跳转到登录
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## 常见任务

### 1. 添加新 API 端点

#### 后端步骤

```python
# 1. 添加模型字段 (models.py)
class ForumPost(models.Model):
    # ... 既有字段 ...
    is_sticky = models.BooleanField(default=False)  # 新字段: 置顶

# 2. 创建迁移
# python manage.py makemigrations forum

# 3. 更新序列化器 (serializers.py)
class ForumPostSerializer(serializers.ModelSerializer):
    class Meta:
        # ...
        fields = [..., 'is_sticky']  # 添加新字段

# 4. 创建 ViewSet 方法 (views.py)
class ForumPostViewSet(viewsets.ModelViewSet):
    # ...
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def set_sticky(self, request, pk=None):
        """设置帖子置顶"""
        post = self.get_object()
        post.is_sticky = request.data.get('sticky', False)
        post.save()
        return Response({'status': 'success'})

# 5. 注册路由 (urls.py)
# router.register(r'posts', ForumPostViewSet)
```

#### 前端步骤

```javascript
// 1. 添加 API 调用 (api/forum.js)
export const setStickyPost = (postId, sticky) => {
  return apiClient.post(`/posts/${postId}/set_sticky/`, { sticky });
};

// 2. 添加前端组件方法
const handleSetSticky = async (postId, sticky) => {
  try {
    await setStickyPost(postId, sticky);
    message.success('操作成功');
    // 更新本地状态
  } catch (error) {
    message.error('操作失败');
  }
};

// 3. 添加 UI 按钮
<Button onClick={() => handleSetSticky(post.id, true)}>
  置顶
</Button>
```

### 2. 添加新数据库表

```bash
# 1. 定义模型 (models.py)
class PostTag(models.Model):
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE)
    tag = models.CharField(max_length=50)
    
    class Meta:
        unique_together = ['post', 'tag']

# 2. 创建迁移
python manage.py makemigrations forum

# 3. 应用迁移
python manage.py migrate

# 4. 验证
python manage.py dbshell
SHOW TABLES;
DESCRIBE forum_posttag;
```

### 3. 添加新权限

```python
# 在 models.py 中定义
class ForumPost(models.Model):
    # ...
    
    class Meta:
        permissions = [
            ("can_moderate_posts", "Can moderate forum posts"),
            ("can_delete_others_posts", "Can delete other users' posts"),
        ]

# 在 permissions.py 中定义权限类
class IsPostModerator(permissions.BasePermission):
    """检查用户是否是帖子版主"""
    
    def has_permission(self, request, view):
        return request.user and request.user.has_perm('forum.can_moderate_posts')

# 在 views.py 中使用
class ForumPostViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsPostModerator]
```

### 4. 创建管理命令

```python
# backend/forum/management/commands/import_posts.py
from django.core.management.base import BaseCommand
from forum.models import ForumPost

class Command(BaseCommand):
    help = '导入帖子数据'
    
    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='CSV 文件路径')
    
    def handle(self, *args, **options):
        file_path = options['file_path']
        
        with open(file_path, 'r') as f:
            for line in f:
                title, content = line.strip().split(',')
                ForumPost.objects.create(title=title, content=content)
        
        self.stdout.write(self.style.SUCCESS('导入成功'))

# 运行
# python manage.py import_posts path/to/file.csv
```

### 5. 添加前端页面

```jsx
// 1. 创建页面组件 (pages/Settings/SettingsPage.jsx)
import React from 'react';

const SettingsPage = () => {
  return (
    <div className="settings-page">
      <h1>设置</h1>
      {/* 设置内容 */}
    </div>
  );
};

export default SettingsPage;

// 2. 添加路由 (App.jsx)
import SettingsPage from './pages/Settings/SettingsPage';

<Route path="/settings" element={<SettingsPage />} />

// 3. 在导航菜单中添加链接
<Link to="/settings">设置</Link>
```

---

## 故障排除

### 数据库连接错误

**错误信息**: `django.db.utils.OperationalError: 1045 Access denied for user`

**解决方案**:
```bash
# 1. 检查 MySQL 是否运行
ps aux | grep mysql

# 2. 检查 .env 文件配置
cat backend/.env | grep DATABASE

# 3. 测试数据库连接
python manage.py dbshell

# 4. 重启 MySQL
sudo systemctl restart mysql  # Linux
brew services restart mysql   # macOS
```

### 迁移冲突

**错误信息**: `django.db.migrations.exceptions.ConflictingMigrations`

**解决方案**:
```bash
# 1. 查看迁移状态
python manage.py showmigrations

# 2. 合并冲突的迁移
python manage.py makemigrations --merge

# 3. 应用迁移
python manage.py migrate
```

### 模块导入错误

**错误信息**: `ModuleNotFoundError: No module named 'users'`

**解决方案**:
```bash
# 1. 检查 PYTHONPATH
echo $PYTHONPATH

# 2. 检查 INSTALLED_APPS
grep -A 20 "INSTALLED_APPS" backend/ai_arena_backend/settings.py

# 3. 重启开发服务器
python manage.py runserver
```

### 前端构建错误

**错误信息**: `error: ENOENT: no such file or directory`

**解决方案**:
```bash
# 1. 清空 node_modules 和锁文件
rm -rf node_modules package-lock.json

# 2. 重新安装依赖
npm install

# 3. 清空构建缓存
rm -rf dist/

# 4. 重新构建
npm run build
```

### CORS 错误

**错误信息**: `Access to XMLHttpRequest has been blocked by CORS policy`

**解决方案**:
```python
# backend/ai_arena_backend/settings.py

CORS_ALLOWED_ORIGINS = [
  "http://82.157.56.206",
  "http://127.0.0.1:3000",
]

# 或允许所有来源 (仅开发时)
CORS_ALLOW_ALL_ORIGINS = True
```

---

## 性能优化

### 数据库查询优化

```python
# ❌ 不好的做法 - N+1 查询问题
for post in ForumPost.objects.all():
    print(post.author.username)  # 每条帖子都会查询一次作者

# ✅ 好的做法 - 使用 select_related
posts = ForumPost.objects.select_related('author')
for post in posts:
    print(post.author.username)  # 只查询一次

# ✅ 对于多对多关系，使用 prefetch_related
posts = ForumPost.objects.prefetch_related('tags')
for post in posts:
    for tag in post.tags.all():  # 高效查询
        print(tag.name)
```

### 缓存优化

```python
from django.views.decorators.cache import cache_page
from django.core.cache import cache

# 方法 1: 缓存视图
@cache_page(60 * 5)  # 缓存 5 分钟
@api_view(['GET'])
def leaderboard(request):
    # ...
    pass

# 方法 2: 缓存数据
def get_popular_posts():
    # 尝试从缓存获取
    popular_posts = cache.get('popular_posts')
    
    if popular_posts is None:
        # 如果缓存不存在，计算并保存
        popular_posts = ForumPost.objects.order_by('-view_count')[:10]
        cache.set('popular_posts', popular_posts, 60 * 10)  # 缓存 10 分钟
    
    return popular_posts
```

### 前端性能优化

```jsx
// 1. 代码分割
const ChatPage = React.lazy(() => import('./pages/Chat/ChatPage'));

// 2. 虚拟化长列表
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={1000}
  itemSize={50}
>
  {({ index, style }) => (
    <div style={style}>
      {items[index].name}
    </div>
  )}
</FixedSizeList>

// 3. 记忆化组件
const PostCard = React.memo(({ post, onLike }) => {
  // 只有在 props 改变时才重新渲染
  return (
    <Card>{post.title}</Card>
  );
});
```

---

**版本**: 2.0  
**最后更新**: 2025-12-08  
**适用范围**: 快速启动 | 环境配置 | 编码规范 | 故障排除  
**项目状态**: ✅ DEVELOPMENT GUIDE COMPLETE
