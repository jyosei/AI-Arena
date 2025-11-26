# Battle聊天数据存储功能说明

## 功能概述

系统已实现完整的Battle模式聊天数据存储功能，所有对话（包括Battle、Side-by-Side和Direct Chat模式）都会自动保存到MySQL数据库中。

## 已实现的功能

### 1. Battle模式数据存储
- ✅ 自动创建conversation记录
- ✅ 保存用户消息
- ✅ 分别保存两个模型的响应
- ✅ 记录模型名称（格式：`model_a vs model_b`）
- ✅ 标记mode为`battle`
- ✅ 支持匿名对战和指定对战

### 2. Direct Chat模式数据存储
- ✅ 保存单个模型的对话
- ✅ 标记mode为`direct-chat`
- ✅ 支持连续对话上下文

### 3. Side-by-Side模式数据存储
- ✅ 同时保存两个模型的响应
- ✅ 标记mode为`side-by-side`
- ✅ 前端通过evaluateModel自动保存

## 数据库结构

### ChatConversation表
存储用户的聊天会话信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 会话唯一标识 |
| user | ForeignKey | 用户ID（关联users.User） |
| title | CharField(200) | 会话标题（取prompt前50字符） |
| model_name | CharField(100) | 模型名称 |
| mode | CharField(20) | 对话模式（battle/direct-chat/side-by-side） |
| created_at | DateTime | 创建时间 |

**model_name格式说明：**
- Battle模式：`"gpt-3.5-turbo vs glm-4"`
- Side-by-Side模式：`"gpt-4 vs claude-3-sonnet"`
- Direct Chat模式：`"gpt-4"`

### ChatMessage表
存储会话中的每条消息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 消息唯一标识 |
| conversation | ForeignKey | 会话ID（关联ChatConversation） |
| role | CharField(10) | 角色（user/assistant） |
| content | TextField | 消息内容 |
| is_user | Boolean | 是否用户消息 |
| model_name | CharField(100) | 生成消息的模型名称（仅AI消息） |
| image | ImageField | 上传的图片（可选） |
| created_at | DateTime | 创建时间 |

**排序规则：** 按created_at升序排列

## API接口

### 1. Battle对战接口

**端点：** `POST /api/models/battle/`

**请求参数：**
```json
{
  "model_a": "gpt-3.5-turbo",      
  "model_b": "glm-4",             
  "prompt": "你好，请介绍一下你自己", 
  "conversation_id": 5,           
  "is_direct_chat": false        
}
```

**响应：**
```json
{
  "prompt": "你好，请介绍一下你自己",
  "results": [
    {
      "model": "gpt-3.5-turbo",
      "response": "你好！我是一个人工智能助手..."
    },
    {
      "model": "glm-4",
      "response": "你好！我是GLM，由智谱AI开发..."
    }
  ],
  "is_anonymous": false,
  "conversation_id": 5
}
```

**自动创建会话规则：**
- 如果提供了`conversation_id`且存在，使用该会话
- 如果未提供`conversation_id`且用户已登录，自动创建新会话
- 未登录用户不会创建会话（但仍可使用对战功能）

### 2. 查看会话历史

**端点：** `GET /api/models/chat/history/`

**认证：** 需要登录（Bearer Token）

**响应：**
```json
[
  {
    "id": 5,
    "title": "你好，请介绍一下你自己",
    "model_name": "gpt-3.5-turbo vs glm-4",
    "mode": "battle",
    "created_at": "2025-11-19T20:45:01.153907-06:00"
  }
]
```

### 3. 查看会话消息

**端点：** `GET /api/models/chat/conversation/{conversation_id}/messages/`

**认证：** 需要登录（Bearer Token）

**响应：**
```json
[
  {
    "id": 15,
    "conversation": 5,
    "content": "你好，请介绍一下你自己",
    "is_user": true,
    "model_name": null,
    "created_at": "2025-11-19T20:45:11.325686-06:00"
  },
  {
    "id": 16,
    "conversation": 5,
    "content": "你好！我是一个人工智能助手...",
    "is_user": false,
    "model_name": "gpt-3.5-turbo",
    "created_at": "2025-11-19T20:45:11.332642-06:00"
  },
  {
    "id": 17,
    "conversation": 5,
    "content": "你好！我是GLM，由智谱AI开发...",
    "is_user": false,
    "model_name": "glm-4",
    "created_at": "2025-11-19T20:45:11.336205-06:00"
  }
]
```

## 测试指南

### 测试Battle数据存储

```powershell
# 1. 获取认证token
$token = (curl.exe http://localhost:8000/api/token/ `
  -H "Content-Type: application/json" `
  -d '{"username":"testuser","password":"test123456"}' `
  -X POST | ConvertFrom-Json).access

# 2. 进行一次battle对战
curl.exe http://localhost:8000/api/models/battle/ `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{"model_a":"gpt-3.5-turbo","model_b":"glm-4","prompt":"你好，请介绍一下你自己"}' `
  -X POST

# 3. 查看保存的消息（使用返回的conversation_id）
curl.exe http://localhost:8000/api/models/chat/conversation/5/messages/ `
  -H "Authorization: Bearer $token"

# 4. 查看所有会话历史
curl.exe http://localhost:8000/api/models/chat/history/ `
  -H "Authorization: Bearer $token"
```

### 测试Direct Chat数据存储

```powershell
# 使用Direct Chat模式
curl.exe http://localhost:8000/api/models/battle/ `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{"model_name":"gpt-4","prompt":"解释一下量子计算","is_direct_chat":true}' `
  -X POST
```

### 验证数据库记录

```powershell
# 直接查询数据库
docker exec -it ai-arena-db-1 mysql -uroot -p123456 -e "
  USE aiarena;
  SELECT * FROM models_manager_chatconversation WHERE user_id = 3;
  SELECT * FROM models_manager_chatmessage WHERE conversation_id = 5;
"
```

## 前端集成

前端无需修改即可使用此功能，因为：

1. **Chat.jsx已支持conversation_id传递**
   - Battle模式通过URL参数`/chat/:id`传递conversation_id
   - `evaluateModel`函数自动传递conversation_id

2. **自动保存机制**
   - 用户登录后，所有对话自动保存
   - 未登录用户可正常使用但不保存历史

3. **历史记录加载**
   - 页面加载时自动从`/api/models/chat/conversation/{id}/messages/`加载历史消息
   - 支持按模式（battle/side-by-side/direct-chat）分配消息到不同栏

## 工作流程

### Battle模式工作流程

```
1. 用户访问 /chat/:id 页面（或创建新会话）
   ↓
2. 前端检查是否存在conversation
   ↓
3. 用户输入prompt并点击发送
   ↓
4. 前端调用 evaluateModel(modelA, prompt, conversationId)
   前端调用 evaluateModel(modelB, prompt, conversationId)
   ↓
5. 后端BattleModelView处理：
   - 检查conversation是否存在
   - 如果不存在且用户已登录，创建新conversation
   - 调用两个模型获取响应
   - 保存用户消息到ChatMessage表
   - 分别保存两个模型的响应到ChatMessage表
   ↓
6. 返回响应给前端
   ↓
7. 前端显示结果并更新UI
```

### 数据持久化流程

```
BattleModelView.post()
  ↓
├─ 获取或创建ChatConversation
│  ├─ 如果提供conversation_id：使用现有会话
│  └─ 如果未提供且用户已登录：创建新会话
│     └─ title = prompt[:50]
│     └─ model_name = "modelA vs modelB"
│     └─ mode = "battle"
│
├─ 调用模型服务
│  ├─ model_a_service.evaluate(prompt, model_a_name)
│  └─ model_b_service.evaluate(prompt, model_b_name)
│
└─ 保存到数据库
   ├─ ChatMessage(role='user', content=prompt)
   ├─ ChatMessage(role='assistant', model_name=modelA, content=responseA)
   └─ ChatMessage(role='assistant', model_name=modelB, content=responseB)
```

## 注意事项

1. **认证要求**
   - 查看历史记录需要登录
   - 未登录用户可使用battle功能但不保存历史

2. **会话管理**
   - 每个会话有唯一ID
   - 会话标题自动取prompt前50字符
   - 会话按创建时间倒序排列

3. **消息排序**
   - 消息按created_at升序排列
   - 保证对话顺序正确

4. **模型名称记录**
   - Battle/Side-by-Side: "modelA vs modelB"
   - Direct Chat: "modelName"
   - AI消息的model_name字段记录具体生成该消息的模型

5. **数据完整性**
   - 用户删除会级联删除所有相关消息
   - conversation删除会级联删除所有相关消息

## 未来扩展

- [ ] 支持会话重命名
- [ ] 支持会话标签/分类
- [ ] 支持会话搜索
- [ ] 支持导出对话记录
- [ ] 支持多轮对话上下文优化
- [ ] 支持图片消息的存储和展示
- [ ] 添加消息编辑/删除功能
- [ ] 支持会话分享功能
