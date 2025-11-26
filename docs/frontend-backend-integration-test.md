# 前后端数据库集成测试指南

本文档提供完整的命令行测试流程，验证前端数据是否正确保存到 MySQL 数据库。

## 环境准备

### 1. 启动所有服务
```powershell
# 启动 Docker Compose 所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 2. 确认服务运行
所有容器应处于 `running` 状态：
- `ai-arena-db-1` (MySQL 8.0)
- `ai-arena-backend-1` (Django)
- `ai-arena-frontend-1` (React + nginx)
- `ai-arena-api-1` (Node.js API)

---

## 一、用户注册功能测试

### 1.1 通过 API 注册新用户

```powershell
# 注册用户 testuser1
$body = @{
    username = 'testuser1'
    password = 'test123456'
    email = 'test1@example.com'
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:8000/api/users/register/ `
    -Method POST `
    -Body $body `
    -ContentType 'application/json' | 
    Select-Object -ExpandProperty Content
```

**预期响应：**
```json
{"id":10,"username":"testuser1"}
```

### 1.2 验证数据库中的用户

```powershell
# 查看所有用户
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, username, email, is_active, date_joined FROM aiarena.users_user ORDER BY id DESC LIMIT 5;"
```

**预期输出：**
```
id      username        email                   is_active       date_joined
10      testuser1       test1@example.com       1              2025-11-20 03:20:15
9       ett                                     1              2025-11-20 03:07:50
8       webtest                                 1              2025-11-20 03:06:38
```

### 1.3 统计用户总数

```powershell
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT COUNT(*) as total_users FROM aiarena.users_user;"
```

---

## 二、用户登录功能测试

### 2.1 用户登录获取 JWT Token

```powershell
# 登录用户
$loginBody = @{
    username = 'testuser1'
    password = 'test123456'
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:8000/api/token/ `
    -Method POST `
    -Body $loginBody `
    -ContentType 'application/json'

# 解析 token
$tokens = $response.Content | ConvertFrom-Json
$accessToken = $tokens.access
$refreshToken = $tokens.refresh

Write-Host "Access Token: $accessToken"
Write-Host "Refresh Token: $refreshToken"
```

**预期响应：**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2.2 验证 Token 有效性

```powershell
# 使用 access token 访问受保护的接口（查看历史记录）
$headers = @{
    Authorization = "Bearer $accessToken"
}

Invoke-WebRequest -Uri http://localhost:8000/api/models/chat/history/ `
    -Method GET `
    -Headers $headers | 
    Select-Object -ExpandProperty Content
```

---

## 三、论坛发帖功能测试

### 3.1 发布新帖子

```powershell
# 先登录获取 token
$loginBody = @{username='testuser1'; password='test123456'} | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri http://localhost:8000/api/token/ `
    -Method POST -Body $loginBody -ContentType 'application/json'
$token = ($loginResponse.Content | ConvertFrom-Json).access

# 发布帖子
$headers = @{
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
}

$postBody = @{
    title = '测试论坛帖子标题'
    content = '这是一篇测试帖子的内容，用于验证数据库存储功能。'
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:8000/api/forum/posts/ `
    -Method POST `
    -Headers $headers `
    -Body $postBody

$response.Content | ConvertFrom-Json | Format-List
```

**预期响应：**
```json
{
  "id": 7,
  "title": "测试论坛帖子标题",
  "slug": "abc12345",
  "author": {
    "id": 10,
    "username": "testuser1",
    "avatar": "",
    "description": ""
  },
  "category": null,
  "status": "published",
  "view_count": 0,
  "like_count": 0,
  "comment_count": 0,
  "created_at": "2025-11-20T03:25:30.123456-06:00",
  "content": "这是一篇测试帖子的内容，用于验证数据库存储功能。"
}
```

### 3.2 查看数据库中的帖子

```powershell
# 查看最新的 5 个帖子
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, author_id, status, view_count, like_count, created_at FROM aiarena.forum_forumpost ORDER BY id DESC LIMIT 5;"
```

**预期输出：**
```
id      author_id       status          view_count      like_count      created_at
7       10              published       0               0               2025-11-20 03:25:30
6       9               published       0               0               2025-11-20 03:11:03
5       8               published       0               0               2025-11-20 03:10:10
```

### 3.3 查看帖子详细内容

```powershell
# 查看指定帖子的完整信息（使用帖子 ID）
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, LENGTH(title) as title_len, LENGTH(content) as content_len, author_id, created_at FROM aiarena.forum_forumpost WHERE id=7;"
```

### 3.4 统计论坛数据

```powershell
# 统计帖子总数
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT COUNT(*) as total_posts FROM aiarena.forum_forumpost;"

# 按用户统计帖子数
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT u.username, COUNT(p.id) as post_count 
     FROM aiarena.users_user u 
     LEFT JOIN aiarena.forum_forumpost p ON u.id = p.author_id 
     GROUP BY u.id, u.username 
     ORDER BY post_count DESC;"
```

---

## 四、三种对话模式完整测试

### 4.1 测试 Direct Chat 模式

```powershell
# 登录获取 token
$loginBody = @{username='webtest'; password='test123456'} | ConvertTo-Json
$loginResponse = Invoke-WebRequest -Uri http://localhost:8000/api/token/ `
    -Method POST -Body $loginBody -ContentType 'application/json'
$token = ($loginResponse.Content | ConvertFrom-Json).access

Write-Host "Token: $($token.Substring(0,20))..." -ForegroundColor Green

# 测试 Direct Chat 模式
$headers = @{
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
}

$directBody = @{
    model_name = 'gpt-3.5-turbo'
    prompt = '请用一句话介绍Python编程语言'
    is_direct_chat = $true
} | ConvertTo-Json

$directResponse = Invoke-WebRequest -Uri http://localhost:8000/api/models/battle/ `
    -Method POST -Headers $headers -Body $directBody

($directResponse.Content | ConvertFrom-Json) | Format-List
```

**预期输出：**
```
prompt          : 请用一句话介绍Python编程语言
results         : {@{model=gpt-3.5-turbo; response=...}}
is_anonymous    : False
is_direct_chat  : True
conversation_id : 13
```

### 4.2 测试 Side-by-Side 模式

```powershell
# 使用上面获取的 token
$sideBySideBody = @{
    model_a = 'gpt-3.5-turbo'
    model_b = 'glm-4'
    prompt = '请用一句话解释人工智能'
    mode = 'side-by-side'
} | ConvertTo-Json

$sideResponse = Invoke-WebRequest -Uri http://localhost:8000/api/models/battle/ `
    -Method POST -Headers $headers -Body $sideBySideBody

($sideResponse.Content | ConvertFrom-Json) | Format-List
```

**预期输出：**
```
prompt          : 请用一句话解释人工智能
results         : {@{model=gpt-3.5-turbo; response=...}, @{model=glm-4; response=...}}
is_anonymous    : False
conversation_id : 14
```

### 4.3 测试 Battle 模式

```powershell
# 使用上面获取的 token
$battleBody = @{
    model_a = 'deepseek-chat'
    model_b = 'qwen-max'
    prompt = '请用一句话描述机器学习'
    mode = 'battle'
} | ConvertTo-Json

$battleResponse = Invoke-WebRequest -Uri http://localhost:8000/api/models/battle/ `
    -Method POST `
    -Headers $headers `
    -Body $battleBody

$battleResult = $battleResponse.Content | ConvertFrom-Json
Write-Host "Battle Conversation ID: $($battleResult.conversation_id)" -ForegroundColor Green
$battleResult | Format-List
```

**预期输出：**
```
prompt          : 请用一句话描述机器学习
results         : {@{model=deepseek-chat; response=...}, @{model=qwen-max; response=...}}
is_anonymous    : False
conversation_id : 15
```

### 4.4 验证数据库中的对话记录

```powershell
# 查看刚才创建的三个对话
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, mode, model_name, SUBSTRING(title, 1, 40) as title, created_at 
     FROM aiarena.models_manager_chatconversation 
     WHERE id IN (13, 14, 15) 
     ORDER BY id;"
```

**预期输出：**
```
id      mode            model_name                    title                   created_at
13      direct-chat     gpt-3.5-turbo                 请用一句话介绍Python      2025-11-20 03:32:33
14      side-by-side    gpt-3.5-turbo vs glm-4        请用一句话解释人工智能    2025-11-20 03:32:45
15      battle          deepseek-chat vs qwen-max     请用一句话描述机器学习    2025-11-20 03:32:59
```

### 4.5 验证消息记录

```powershell
# 查看 Side-by-Side 模式的消息（ID 14）
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, role, model_name, SUBSTRING(content, 1, 40) as content_preview 
     FROM aiarena.models_manager_chatmessage 
     WHERE conversation_id = 14 
     ORDER BY id;"
```

**预期输出：**
```
id      role        model_name      content_preview
23      user        NULL            请用一句话解释人工智能
24      assistant   gpt-3.5-turbo   人工智能是计算机科学的一个分支...
25      assistant   glm-4           AI是模拟人类智能的技术...
```

### 4.6 统计各模式的对话和消息数

```powershell
# 统计每种模式的对话数和消息数
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT 
        c.mode,
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(m.id) as message_count
     FROM aiarena.models_manager_chatconversation c
     LEFT JOIN aiarena.models_manager_chatmessage m ON c.id = m.conversation_id
     GROUP BY c.mode
     ORDER BY c.mode;"
```

**预期输出：**
```
mode            conversation_count      message_count
battle          2                       6
direct-chat     3                       9
side-by-side    1                       3
```

### 4.7 通过 API 查看历史记录

```powershell
# 查看用户的所有对话历史
$headers = @{Authorization = "Bearer $token"}

$historyResponse = Invoke-WebRequest -Uri http://localhost:8000/api/models/chat/history/ `
    -Method GET `
    -Headers $headers

($historyResponse.Content | ConvertFrom-Json) | 
    Select-Object id, mode, model_name, title, created_at | 
    Format-Table
```

**预期输出：**
```
id mode         model_name                title                      created_at
-- ----         ----------                -----                      ----------
15 battle       deepseek-chat vs qwen-max 请用一句话描述机器学习       2025-11-20T03:32:59
14 side-by-side gpt-3.5-turbo vs glm-4    请用一句话解释人工智能       2025-11-20T03:32:45
13 direct-chat  gpt-3.5-turbo             请用一句话介绍Python        2025-11-20T03:32:33
```

### 4.8 查看特定对话的完整消息

```powershell
# 查看 Side-by-Side 对话（ID 14）的所有消息
$conversationId = 14

$messagesResponse = Invoke-WebRequest `
    -Uri "http://localhost:8000/api/models/chat/conversation/$conversationId/messages/" `
    -Method GET `
    -Headers $headers

($messagesResponse.Content | ConvertFrom-Json) | 
    Select-Object id, role, model_name, @{
        Name='content_preview'
        Expression={$_.content.Substring(0, [Math]::Min(50, $_.content.Length))}
    } | 
    Format-Table
```

**预期输出：**
```
id role      model_name    content_preview
-- ----      ----------    ---------------
23 user                    请用一句话解释人工智能
24 assistant gpt-3.5-turbo 人工智能是计算机科学的一个分支，致力于创建能够执行...
25 assistant glm-4         AI是模拟人类智能的技术，使机器能够学习、推理和...
```

---

## 五、前后端数据一致性验证

### 5.1 前端操作 → 后端验证

**步骤：**
1. 在前端登录账号（webtest / test123456）
2. 在前端创建一个新对话（任意模式）
3. 在后端查看是否立即出现

```powershell
# 实时监控最新对话
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, mode, model_name, created_at 
     FROM aiarena.models_manager_chatconversation 
     ORDER BY id DESC 
     LIMIT 1;"
```

**验证点：**
- ✅ 对话 ID 自动递增
- ✅ mode 字段正确（direct-chat/side-by-side/battle）
- ✅ model_name 格式正确
  - Direct Chat: `gpt-3.5-turbo`
  - Side-by-Side: `gpt-3.5-turbo vs glm-4`
  - Battle: `deepseek-chat vs qwen-max`
- ✅ created_at 时间戳正确

### 5.2 后端数据 → 前端显示

**步骤：**
1. 通过 API 创建对话（使用上面的测试命令）
2. 刷新前端页面
3. 检查左侧历史记录是否显示新对话
4. 点击对话，验证消息内容正确加载

```powershell
# 创建测试对话
$testBody = @{
    model_name = 'gpt-4'
    prompt = '这是一个测试对话'
    is_direct_chat = $true
} | ConvertTo-Json

$testResponse = Invoke-WebRequest -Uri http://localhost:8000/api/models/battle/ `
    -Method POST -Headers $headers -Body $testBody

$newConvId = ($testResponse.Content | ConvertFrom-Json).conversation_id
Write-Host "新对话 ID: $newConvId - 请在前端查看是否出现" -ForegroundColor Yellow
```

**验证点：**
- ✅ 前端历史列表显示新对话
- ✅ 对话标题正确
- ✅ 点击对话后消息正确显示
- ✅ 消息顺序正确（用户消息 → AI响应）
- ✅ 在对应模式下，消息分配到正确的栏位

### 5.3 Django Admin 后台验证

**步骤：**
1. 访问 http://localhost:8000/admin/
2. 使用超级用户登录（shallcheer）
3. 查看 `Chat conversations` 和 `Chat messages`

**验证操作：**

```powershell
# 查看所有对话（包括用户信息）
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT c.id, u.username, c.mode, c.model_name, c.title 
     FROM aiarena.models_manager_chatconversation c
     JOIN aiarena.users_user u ON c.user_id = u.id
     ORDER BY c.id DESC
     LIMIT 10;"
```

**在 Django Admin 中可以：**
- ✅ 查看所有用户的对话记录
- ✅ 编辑对话标题和设置
- ✅ 删除对话（会级联删除消息）
- ✅ 查看每条消息的详细内容（包括中文）
- ✅ 按用户、模式、日期筛选对话
- ✅ 导出数据

### 5.4 三端数据一致性检查

创建一个完整的测试流程：

```powershell
Write-Host "=== 三端数据一致性测试 ===" -ForegroundColor Cyan

# 1. 通过API创建对话
$apiBody = @{
    model_a = 'gpt-3.5-turbo'
    model_b = 'glm-4'
    prompt = '三端一致性测试'
    mode = 'side-by-side'
} | ConvertTo-Json

$apiResponse = Invoke-WebRequest -Uri http://localhost:8000/api/models/battle/ `
    -Method POST -Headers $headers -Body $apiBody

$convId = ($apiResponse.Content | ConvertFrom-Json).conversation_id
Write-Host "[1] API创建对话 ID: $convId" -ForegroundColor Green

# 2. 查询数据库验证
Write-Host "[2] 数据库验证..." -ForegroundColor Yellow
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, mode, model_name FROM aiarena.models_manager_chatconversation WHERE id=$convId;" 2>$null

# 3. 通过API加载历史
Write-Host "[3] API历史记录验证..." -ForegroundColor Yellow
$histCheck = Invoke-WebRequest -Uri http://localhost:8000/api/models/chat/history/ `
    -Method GET -Headers $headers
$history = $histCheck.Content | ConvertFrom-Json
$found = $history | Where-Object { $_.id -eq $convId }
if ($found) {
    Write-Host "✓ API历史记录中找到对话 $convId" -ForegroundColor Green
} else {
    Write-Host "✗ API历史记录中未找到对话 $convId" -ForegroundColor Red
}

Write-Host "[4] 请在前端验证对话 $convId 是否显示" -ForegroundColor Yellow
Write-Host "[5] 请在 Django Admin 验证对话 $convId" -ForegroundColor Yellow
Write-Host "    访问: http://localhost:8000/admin/models_manager/chatconversation/$convId/change/" -ForegroundColor Gray
```

---

## 六、综合数据统计与分析

### 6.1 按模式统计对话和消息

```powershell
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT 
        c.mode,
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(m.id) as total_messages,
        ROUND(AVG(msg_per_conv.msg_count), 2) as avg_messages_per_conversation
     FROM aiarena.models_manager_chatconversation c
     LEFT JOIN aiarena.models_manager_chatmessage m ON c.id = m.conversation_id
     LEFT JOIN (
         SELECT conversation_id, COUNT(*) as msg_count
         FROM aiarena.models_manager_chatmessage
         GROUP BY conversation_id
     ) msg_per_conv ON c.id = msg_per_conv.conversation_id
     GROUP BY c.mode;"
```

### 6.2 按用户统计活跃度

```powershell
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT 
        u.username,
        COUNT(DISTINCT c.id) as conversations,
        COUNT(DISTINCT CASE WHEN c.mode='direct-chat' THEN c.id END) as direct_chats,
        COUNT(DISTINCT CASE WHEN c.mode='side-by-side' THEN c.id END) as side_by_sides,
        COUNT(DISTINCT CASE WHEN c.mode='battle' THEN c.id END) as battles,
        COUNT(m.id) as total_messages
     FROM aiarena.users_user u
     LEFT JOIN aiarena.models_manager_chatconversation c ON u.id = c.user_id
     LEFT JOIN aiarena.models_manager_chatmessage m ON c.id = m.conversation_id
     GROUP BY u.id, u.username
     HAVING conversations > 0
     ORDER BY conversations DESC;"
```

### 6.3 查看最活跃的模型

```powershell
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT 
        model_name,
        COUNT(*) as usage_count
     FROM aiarena.models_manager_chatmessage
     WHERE model_name IS NOT NULL
     GROUP BY model_name
     ORDER BY usage_count DESC
     LIMIT 10;"
```

### 6.4 查看最近活动

```powershell
# 查看最近 10 条用户注册
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, username, date_joined FROM aiarena.users_user ORDER BY date_joined DESC LIMIT 10;"

# 查看最近 10 个帖子
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT p.id, u.username, p.status, p.created_at 
     FROM aiarena.forum_forumpost p 
     JOIN aiarena.users_user u ON p.author_id = u.id 
     ORDER BY p.created_at DESC LIMIT 10;"

# 查看最近 10 个对话
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT c.id, u.username, c.mode, c.model_name, c.created_at 
     FROM aiarena.models_manager_chatconversation c 
     JOIN aiarena.users_user u ON c.user_id = u.id 
     ORDER BY c.created_at DESC LIMIT 10;"
```

---

## 六、综合数据统计与分析

### 5.1 查看所有表的数据量

```powershell
docker exec ai-arena-db-1 mysql -uroot -p123456 -e "
USE aiarena;
SELECT 
    'users_user' as table_name, COUNT(*) as count FROM users_user
UNION ALL
SELECT 
    'forum_forumpost', COUNT(*) FROM forum_forumpost
UNION ALL
SELECT 
    'forum_forumcomment', COUNT(*) FROM forum_forumcomment
UNION ALL
SELECT 
    'models_manager_chatconversation', COUNT(*) FROM models_manager_chatconversation
UNION ALL
SELECT 
    'models_manager_chatmessage', COUNT(*) FROM models_manager_chatmessage
UNION ALL
SELECT 
    'models_manager_battlevote', COUNT(*) FROM models_manager_battlevote;
"
```

### 5.2 查看最近活动

```powershell
# 查看最近 10 条用户注册
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, username, date_joined FROM aiarena.users_user ORDER BY date_joined DESC LIMIT 10;"

# 查看最近 10 个帖子
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT p.id, u.username, p.status, p.created_at 
     FROM aiarena.forum_forumpost p 
     JOIN aiarena.users_user u ON p.author_id = u.id 
     ORDER BY p.created_at DESC LIMIT 10;"

# 查看最近 10 个对话
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT c.id, u.username, c.mode, c.model_name, c.created_at 
     FROM aiarena.models_manager_chatconversation c 
     JOIN aiarena.users_user u ON c.user_id = u.id 
     ORDER BY c.created_at DESC LIMIT 10;"
```

---

## 六、Django 管理后台访问

### 6.1 访问管理后台

1. 打开浏览器访问: **http://localhost:8000/admin/**
2. 使用超级用户登录:
   - 用户名: `shallcheer`
   - 密码: (创建时设置的密码)

### 6.2 创建新的超级用户（如需要）

```powershell
# 创建超级用户
docker exec -it ai-arena-backend-1 python manage.py createsuperuser

# 或者修改现有用户密码
docker exec -it ai-arena-backend-1 python manage.py changepassword <username>
```

### 6.3 管理后台功能

在 Django Admin 中可以:
- ✅ 查看和编辑所有用户
- ✅ 查看和管理论坛帖子、评论
- ✅ 查看 Battle 对话历史
- ✅ 查看聊天消息记录
- ✅ 管理用户权限和分组

---

## 七、前端集成测试

### 7.1 前端注册测试

1. 打开浏览器访问: **http://localhost:8000**
2. 点击"注册"按钮
3. 填写注册信息:
   - 用户名: `frontend_user`
   - 密码: `test123456`
   - 邮箱: `frontend@test.com`
4. 提交注册

**验证数据库：**
```powershell
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, username, email FROM aiarena.users_user WHERE username='frontend_user';"
```

### 7.2 前端登录测试

1. 使用刚注册的账号登录
2. 打开浏览器开发者工具 (F12)
3. 查看 Network 标签，确认:
   - POST `/api/token/` 返回 200
   - Response 包含 `access` 和 `refresh` token
4. 查看 Application → Local Storage，确认 token 已保存

### 7.3 前端论坛发帖测试

1. 登录后进入论坛页面
2. 点击"发帖"按钮
3. 填写标题和内容
4. 提交帖子

**验证数据库：**
```powershell
# 查看最新帖子
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, title, author_id, created_at FROM aiarena.forum_forumpost ORDER BY id DESC LIMIT 1;"
```

### 7.4 前端 Battle 测试

1. 登录后进入 Battle 页面
2. 输入问题进行对战
3. 查看两个模型的响应

**验证数据库：**
```powershell
# 查看最新对话
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "SELECT id, title, mode, model_name, created_at FROM aiarena.models_manager_chatconversation ORDER BY id DESC LIMIT 1;"
```

---

## 八、数据库直接查询指南

### 8.1 进入 MySQL 交互模式

```powershell
docker exec -it ai-arena-db-1 mysql -uroot -p123456 aiarena
```

### 8.2 常用查询命令

```sql
-- 查看所有表
SHOW TABLES;

-- 查看表结构
DESCRIBE users_user;
DESCRIBE forum_forumpost;
DESCRIBE models_manager_chatconversation;

-- 查询用户信息
SELECT id, username, email, is_superuser, date_joined FROM users_user;

-- 查询论坛帖子
SELECT p.id, p.title, u.username, p.created_at 
FROM forum_forumpost p 
JOIN users_user u ON p.author_id = u.id 
ORDER BY p.created_at DESC;

-- 查询 Battle 对话
SELECT c.id, u.username, c.mode, c.model_name, COUNT(m.id) as message_count
FROM models_manager_chatconversation c
JOIN users_user u ON c.user_id = u.id
LEFT JOIN models_manager_chatmessage m ON c.id = m.conversation_id
GROUP BY c.id
ORDER BY c.created_at DESC;

-- 退出
EXIT;
```

---

## 九、故障排查

### 9.1 容器未启动

```powershell
# 查看容器状态
docker-compose ps

# 查看容器日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db

# 重启服务
docker-compose restart
```

### 9.2 数据库连接失败

```powershell
# 测试数据库连接
docker exec ai-arena-db-1 mysql -uroot -p123456 -e "SELECT 1;"

# 检查 backend 环境变量
docker exec ai-arena-backend-1 env | grep DB_
```

### 9.3 CSRF 错误

如果访问 `/admin/` 出现 CSRF 错误，确认 `settings.py` 中已配置:
```python
CSRF_TRUSTED_ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000']
```

### 9.4 nginx 代理问题

```powershell
# 查看 nginx 配置
docker exec ai-arena-frontend-1 cat /etc/nginx/conf.d/default.conf

# 测试 nginx 配置
docker exec ai-arena-frontend-1 nginx -t

# 重启 frontend
docker-compose restart frontend
```

---

## 十、清理和重置

### 10.1 清空测试数据

```powershell
# 清空所有帖子
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "DELETE FROM aiarena.forum_forumpost WHERE id > 0;"

# 清空所有对话
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "DELETE FROM aiarena.models_manager_chatmessage WHERE id > 0;
     DELETE FROM aiarena.models_manager_chatconversation WHERE id > 0;"

# 清空非管理员用户
docker exec ai-arena-db-1 mysql -uroot -p123456 -e `
    "DELETE FROM aiarena.users_user WHERE is_superuser = 0;"
```

### 10.2 完全重置数据库

```powershell
# 停止所有服务
docker-compose down

# 删除数据卷（会删除所有数据）
docker volume rm ai-arena_db_data

# 重新启动
docker-compose up -d

# 等待数据库初始化，然后运行迁移
docker exec ai-arena-backend-1 python manage.py migrate
```

---

## 总结

通过以上测试流程，可以完整验证：

✅ 用户注册数据正确保存到 `users_user` 表  
✅ 用户登录返回有效的 JWT token  
✅ 论坛帖子保存到 `forum_forumpost` 表  
✅ Battle 对话保存到 `chatconversation` 和 `chatmessage` 表  
✅ Django 管理后台可以访问和管理所有数据  
✅ 前端操作的数据都正确存入数据库  

**所有功能均已打通，前后端数据库集成完成！**
