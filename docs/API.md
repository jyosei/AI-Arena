# API 文档

AI-Arena 后端 API 接口文档

> 编辑: shallcheer

## 基础信息

- **Base URL**: `http://localhost:8000/api/`
- **认证方式**: JWT (JSON Web Token)
- **Content-Type**: `application/json`

## 认证

大部分 API 需要在请求头中携带 JWT token：

```
Authorization: Bearer <access_token>
```

### 获取 Token

**POST** `/api/token/`

**请求体：**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**响应：**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 刷新 Token

**POST** `/api/token/refresh/`

**请求体：**
```json
{
  "refresh": "your_refresh_token"
}
```

---

## 用户 API

### 1. 用户注册

**POST** `/api/users/register/`

**权限**: 无需认证

**请求体：**
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**响应：**
```json
{
  "id": 1,
  "username": "testuser",
  "description": "",
  "avatar": "",
  "avatar_url": ""
}
```

### 2. 获取用户资料

**GET** `/api/users/profile/`

**权限**: 需要认证

**响应：**
```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "description": "个人简介",
  "avatar": "/media/users/avatars/avatar.jpg",
  "avatar_url": "http://localhost:8000/media/users/avatars/avatar.jpg",
  "is_staff": false
}
```

### 3. 更新用户资料

**PATCH** `/api/users/profile/`

**权限**: 需要认证

**请求体：**
```json
{
  "description": "我的新简介",
  "avatar": "<base64_image_or_file>"
}
```

### 4. 修改密码

**POST** `/api/users/change-password/`

**权限**: 需要认证

**请求体：**
```json
{
  "old_password": "old_pass123",
  "new_password": "new_pass456"
}
```

### 5. 获取通知列表

**GET** `/api/users/notifications/`

**权限**: 需要认证

**查询参数：**
- `unread=true` - 只获取未读通知

**响应：**
```json
{
  "results": [
    {
      "id": 1,
      "action_type": "like",
      "message": "用户A 点赞了你的帖子",
      "is_read": false,
      "created_at": "2025-11-27T10:00:00Z",
      "actor": {
        "id": 2,
        "username": "userA"
      }
    }
  ],
  "unread_count": 5
}
```

### 6. 标记通知为已读

**POST** `/api/users/notifications/<id>/read/`

**权限**: 需要认证

### 7. 标记所有通知为已读

**POST** `/api/users/notifications/mark-all-read/`

**权限**: 需要认证

---

## 论坛 API

### 1. 获取分类列表

**GET** `/api/forum/categories/`

**权限**: 无需认证

**响应：**
```json
[
  {
    "id": 1,
    "name": "技术讨论",
    "slug": "tech",
    "description": "技术相关话题",
    "post_count": 50
  }
]
```

### 2. 获取标签列表

**GET** `/api/forum/tags/`

**权限**: 无需认证

### 3. 获取帖子列表

**GET** `/api/forum/posts/`

**权限**: 无需认证

**查询参数：**
- `page=1` - 页码
- `page_size=20` - 每页数量
- `ordering=latest|hottest|popular` - 排序方式
- `category=<category_id>` - 按分类筛选
- `tag=<tag_id>` - 按标签筛选
- `search=<keyword>` - 搜索关键词

**响应：**
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/forum/posts/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "如何使用 AI Arena",
      "slug": "how-to-use-ai-arena",
      "content": "这是帖子内容...",
      "status": "published",
      "author": {
        "id": 1,
        "username": "testuser",
        "avatar_url": "..."
      },
      "category_obj": {
        "id": 1,
        "name": "教程"
      },
      "tags": [
        {"id": 1, "name": "新手"}
      ],
      "images": [],
      "view_count": 100,
      "like_count": 10,
      "comment_count": 5,
      "favorite_count": 3,
      "created_at": "2025-11-27T10:00:00Z",
      "updated_at": "2025-11-27T10:00:00Z"
    }
  ]
}
```

### 4. 创建帖子

**POST** `/api/forum/posts/`

**权限**: 需要认证

**请求体：**
```json
{
  "title": "我的新帖子",
  "content": "帖子内容，支持 Markdown",
  "category_obj": 1,
  "tags": [1, 2],
  "status": "published",
  "allow_comments": true
}
```

### 5. 获取帖子详情

**GET** `/api/forum/posts/<id>/`

**权限**: 无需认证

### 6. 更新帖子

**PATCH** `/api/forum/posts/<id>/`

**权限**: 需要认证（仅作者）

### 7. 删除帖子

**DELETE** `/api/forum/posts/<id>/`

**权限**: 需要认证（仅作者或管理员）

### 8. 点赞/取消点赞帖子

**POST** `/api/forum/posts/<id>/like/`

**权限**: 需要认证

### 9. 收藏/取消收藏帖子

**POST** `/api/forum/posts/<id>/favorite/`

**权限**: 需要认证

### 10. 获取帖子评论

**GET** `/api/forum/posts/<post_id>/comments/`

**权限**: 无需认证

### 11. 创建评论

**POST** `/api/forum/posts/<post_id>/comments/`

**权限**: 需要认证

**请求体：**
```json
{
  "content": "这是我的评论",
  "parent": null
}
```

### 12. 点赞评论

**POST** `/api/forum/comments/<comment_id>/like/`

**权限**: 需要认证

---

## AI 模型 API

### 1. 获取模型列表

**GET** `/api/models/`

**权限**: 无需认证

**响应：**
```json
[
  {
    "id": 1,
    "name": "gpt-3.5-turbo",
    "display_name": "GPT-3.5 Turbo",
    "provider": "OpenAI",
    "description": "快速高效的对话模型",
    "is_active": true
  }
]
```

### 2. 创建对话

**POST** `/api/models/chat/conversation/`

**权限**: 需要认证

**请求体：**
```json
{
  "title": "我的对话"
}
```

### 3. 获取对话历史

**GET** `/api/models/chat/history/`

**权限**: 需要认证

### 4. 获取对话消息

**GET** `/api/models/chat/conversation/<id>/messages/`

**权限**: 需要认证

### 5. 发送消息

**POST** `/api/models/chat/conversation/<id>/messages/`

**权限**: 需要认证

**请求体：**
```json
{
  "content": "你好，请介绍一下自己",
  "model_name": "gpt-3.5-turbo"
}
```

### 6. 模型对战

**POST** `/api/models/battle/`

**权限**: 需要认证

**请求体：**
```json
{
  "prompt": "解释一下量子计算的原理",
  "model_a": "gpt-3.5-turbo",
  "model_b": "gpt-4"
}
```

**响应：**
```json
{
  "battle_id": "uuid-xxx",
  "model_a_response": "量子计算是...",
  "model_b_response": "量子计算机利用...",
  "timestamp": "2025-11-27T10:00:00Z"
}
```

### 7. 投票

**POST** `/api/models/battle/<battle_id>/vote/`

**权限**: 需要认证

**请求体：**
```json
{
  "winner": "model_a"
}
```

### 8. 排行榜

**GET** `/api/models/leaderboard/`

**权限**: 无需认证

**查询参数：**
- `metric=score|win_rate|battles` - 排序指标

**响应：**
```json
[
  {
    "id": 1,
    "rank": 1,
    "name": "gpt-4",
    "owner_name": "OpenAI",
    "score": 1500,
    "win_rate": 0.75,
    "total_battles": 100
  }
]
```

---

## 错误响应

所有 API 在出错时会返回以下格式：

```json
{
  "detail": "错误信息"
}
```

或：

```json
{
  "field_name": ["错误信息1", "错误信息2"]
}
```

### 常见 HTTP 状态码

- `200 OK` - 请求成功
- `201 Created` - 资源创建成功
- `204 No Content` - 删除成功
- `400 Bad Request` - 请求参数错误
- `401 Unauthorized` - 未认证
- `403 Forbidden` - 权限不足
- `404 Not Found` - 资源不存在
- `500 Internal Server Error` - 服务器错误

---

## 文件上传

上传图片时可以使用 `multipart/form-data` 或 Base64 编码：

### 方式1：multipart/form-data

```bash
curl -X POST http://localhost:8000/api/users/profile/ \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@/path/to/image.jpg"
```

### 方式2：Base64 编码

```json
{
  "avatar": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

---

## 分页

所有列表 API 都支持分页，响应格式：

```json
{
  "count": 100,
  "next": "http://localhost:8000/api/endpoint/?page=2",
  "previous": null,
  "results": [...]
}
```

查询参数：
- `page=<number>` - 页码（从1开始）
- `page_size=<number>` - 每页数量（默认20，最大100）

---

## 速率限制

当前版本暂无速率限制，生产环境建议添加。

---

更多 API 细节请参考后端代码或联系开发团队。
