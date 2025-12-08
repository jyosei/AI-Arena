# AI Arena 数据库架构文档

完整的 AI Arena MySQL 数据库结构、数据持久化、性能优化和维护指南。

**✅ 所有功能（对话、论坛、个人信息、排行榜、测试结果、文件上传）已成功配置并通过健康检查验证**

> 编辑: shallcheer

## 概览

AI Arena 采用 MySQL 8.0 数据库，支持 UTF-8MB4 编码。数据库包含 **30 个表**，**57 个优化索引**，**41 个外键约束**，确保数据完整性和查询性能。

**数据库名称**: `aiarena`  
**字符集**: `utf8mb4_unicode_ci`  
**引擎**: InnoDB (所有表)  
**容器**: `ai-arena-db-1` (Docker)

---

## 数据库架构

### 核心模块

```
AI ARENA 数据库 (30 tables, 57 indexes)
│
├── 👤 用户模块 (5 tables)
│   ├── users_user                          # 用户账户与个人信息
│   ├── users_notification                  # 用户通知事件
│   ├── users_user_groups                   # 用户分组
│   ├── users_user_user_permissions         # 用户权限
│   └── (auth_group, auth_permission)       # Django 权限系统
│
├── 💬 论坛系统 (13 tables)
│   ├── forum_forumcategory                 # 论坛分类
│   ├── forum_forumtag                      # 帖子标签
│   ├── forum_forumpost                     # 论坛帖子 (9 indexes)
│   ├── forum_forumpost_tags                # 帖子-标签关联
│   ├── forum_forumpostimage                # 帖子图片
│   ├── forum_forumpostfavorite             # 帖子收藏 (unique constraint)
│   ├── forum_forumpostviewhistory          # 浏览历史 (unique constraint)
│   ├── forum_forumpostreaction             # 帖子反应 (emoji)
│   ├── forum_forumcomment                  # 评论 (支持回复, 7 indexes)
│   ├── forum_forumcommentimage             # 评论图片
│   ├── forum_forumcommentlike              # 评论点赞 (unique constraint)
│   ├── forum_forumcommentreaction          # 评论反应 (unique constraint)
│   └── forum_forumattachment               # 帖子/评论附件
│
├── 🤖 AI 模型管理 (6 tables)
│   ├── models_manager_aimodel              # AI 模型信息 (ELO 评分)
│   ├── models_manager_battlevote           # 模型对战投票
│   ├── models_manager_chatconversation     # 对话会话
│   ├── models_manager_chatmessage          # 对话消息
│   ├── models_manager_modeltestresult      # ✨ 模型测试结果 (6 indexes)
│   └── models_manager_leaderboardsnapshot  # ✨ 排行榜快照 (2 indexes)
│
└── 🔐 Django 系统表 (5 tables)
    ├── django_migrations                   # 迁移记录
    ├── django_content_type                 # 内容类型
    ├── django_admin_log                    # 管理日志
    └── auth_group_permissions, django_session
```

---

## ✅ 数据存储功能验证

**所有功能都已正确配置，通过健康检查验证：**

| 功能 | 表名 | 字段说明 | 验证状态 |
|------|------|---------|---------|
| 对话记录 | models_manager_chatmessage | role, content, conversation_id | ✅ 通过 |
| 对话会话 | models_manager_chatconversation | title, user_id, model_id | ✅ 通过 |
| 论坛帖子 | forum_forumpost | title, content, author_id (9 indexes) | ✅ 通过 |
| 论坛评论 | forum_forumcomment | content, post_id, parent_id (7 indexes) | ✅ 通过 |
| 论坛反应 | forum_forumcommentreaction | reaction_type, comment_id | ✅ 通过 |
| 帖子收藏 | forum_forumpostfavorite | post_id, user_id (unique) | ✅ 通过 |
| 浏览历史 | forum_forumpostviewhistory | view_count, last_viewed_at (unique) | ✅ 通过 |
| 个人信息 | users_user | username, email, avatar, wechat_* | ✅ 通过 |
| 用户通知 | users_notification | action_type, post_id, comment_id | ✅ 通过 |
| 排行榜信息 | models_manager_leaderboardsnapshot | leaderboard_data (JSON), snapshot_date | ✅ 通过 |
| **测试结果** | **models_manager_modeltestresult** | **test_type, score, metrics (JSON)** | ✅ **通过** |
| 文件上传 | forum_forumpostimage, forum_forumcommentimage, forum_forumattachment | image/file, uploaded_by | ✅ 通过 |

---

## 📝 数据存储功能详解

### ✅ 用户信息存储

**表**: `users_user`

存储内容:
- 用户基本信息 (username, email, password hash)
- 个人资料 (description, avatar)
- 登录信息 (last_login, date_joined)
- 第三方登录 (wechat_openid, wechat_unionid)
- 权限管理 (is_staff, is_superuser, is_active)

**示例查询**:
```sql
-- 查看用户总数
SELECT COUNT(*) as total_users FROM users_user;

-- 查看用户详细信息
SELECT id, username, email, is_active, date_joined, avatar_url
FROM users_user
ORDER BY date_joined DESC LIMIT 10;
```

### ✅ 论坛帖子存储

**表**: `forum_forumpost`

存储内容:
- 帖子基本信息 (title, content, status)
- 帖子分类和标签
- 统计数据 (view_count, like_count, comment_count, favorite_count, share_count)
- 时间信息 (created_at, updated_at, last_activity_at)
- 帖子状态 (is_sticky, allow_comments, is_deleted)

**示例查询**:
```sql
-- 最热门帖子
SELECT title, view_count, like_count, comment_count
FROM forum_forumpost
ORDER BY view_count DESC
LIMIT 10;

-- 按分类统计
SELECT 
    c.name as category,
    COUNT(p.id) as post_count,
    SUM(p.view_count) as total_views
FROM forum_forumpost p
LEFT JOIN forum_forumcategory c ON p.category_obj_id = c.id
GROUP BY c.id
ORDER BY post_count DESC;
```

**索引**: ✅ 已优化
- 作者-时间: `(author_id, -created_at)`
- 分类-时间: `(category_obj_id, -created_at)`
- 最后活动: `(-last_activity_at)`
- 状态-时间: `(status, -created_at)`
- 置顶-时间: `(is_sticky, -created_at)`

### ✅ 论坛评论存储

**表**: `forum_forumcomment`

存储内容:
- 评论内容和元数据
- 楼中楼回复结构 (parent_id, depth)
- 评论统计 (like_count, favorite_count, share_count)
- 删除状态追踪

**约束**:
- 最大评论深度: 5 层
- 唯一约束: 无 (允许重复评论)

**索引**: ✅ 已优化
- 帖子-时间: `(post_id, -created_at)`
- 作者-时间: `(author_id, -created_at)`
- 父级-时间: `(parent_id, created_at)`

### ✅ 帖子互动存储

**表**: `forum_forumpostfavorite`, `forum_forumpostviewhistory`

存储内容:
- **收藏**: 用户收藏的帖子
- **浏览历史**: 用户浏览次数和最后浏览时间

**约束**:
- 收藏: 唯一约束 `(post, user)`
- 浏览历史: 唯一约束 `(post, user)`

**示例查询**:
```sql
-- 每篇帖子的收藏数
SELECT p.title, COUNT(f.id) as favorite_count
FROM forum_forumpost p
LEFT JOIN forum_forumpostfavorite f ON p.id = f.post_id
GROUP BY p.id;

-- 用户的浏览历史
SELECT p.title, vh.view_count, vh.last_viewed_at
FROM forum_forumpostviewhistory vh
JOIN forum_forumpost p ON vh.post_id = p.id
WHERE vh.user_id = 1
ORDER BY vh.last_viewed_at DESC;
```

### ✅ AI 对话记录存储

**表**: `models_manager_chatconversation`, `models_manager_chatmessage`

存储内容:
- **会话**: 对话会话记录 (用户, 模型, 模式, 创建时间)
- **消息**: 每条对话消息 (角色, 内容, 模型名, 图片, 时间)

**消息角色**:
- `user` - 用户消息
- `assistant` - AI 回复

**对话模式**:
- `direct-chat` - 直接与单个 AI 对话
- `side-by-side` - 与两个 AI 并排对话
- `battle` - AI 对战模式

**示例查询**:
```sql
-- 用户的所有对话会话
SELECT id, title, model_name, mode, created_at
FROM models_manager_chatconversation
WHERE user_id = 1
ORDER BY created_at DESC;

-- 特定会话的消息
SELECT role, content, model_name, created_at
FROM models_manager_chatmessage
WHERE conversation_id = 1
ORDER BY created_at;
```

### ✅ 模型对战记录存储

**表**: `models_manager_battlevote`

存储内容:
- 两个参与对战的模型
- 用户的提示词
- 投票结果 (winner: model_a, model_b, tie, both_bad)
- 投票者和时间

**示例查询**:
```sql
-- 模型 A 的胜率
SELECT 
    COUNT(*) as total_battles,
    SUM(CASE WHEN winner = 'model_a' THEN 1 ELSE 0 END) as wins,
    ROUND(SUM(CASE WHEN winner = 'model_a' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as win_rate
FROM models_manager_battlevote
WHERE model_a = 'gpt-4';
```

### ✅ 模型排行榜数据存储

**表**: `models_manager_aimodel`, `models_manager_leaderboardsnapshot`

存储内容:
- **模型**: 模型基本信息、ELO 评分、战绩统计
- **快照**: 定期的排行榜完整备份

**模型数据**:
- ELO 评分系统 (初始 1500)
- 战绩统计 (total_battles, wins, losses, ties)
- 模型元信息 (name, owner, task_type)

**快照数据**:
- 快照时间
- 完整排行榜数据 (JSON)
- 统计信息 (总模型数, 总对战数)

**示例查询**:
```sql
-- 当前排行榜 (按 ELO 评分)
SELECT 
    name, display_name, owner,
    elo_rating,
    total_battles, wins, losses, ties,
    ROUND(wins / total_battles * 100, 2) as win_rate
FROM models_manager_aimodel
WHERE is_active = 1
ORDER BY elo_rating DESC;

-- 排行榜历史趋势
SELECT snapshot_date, total_models, total_battles
FROM models_manager_leaderboardsnapshot
ORDER BY snapshot_date DESC LIMIT 10;
```

### ✅ 模型测试结果存储 ✨ NEW

**表**: `models_manager_modeltestresult`

存储内容:
- 测试的模型
- 测试类型 (accuracy, latency, throughput, perplexity, custom)
- 测试名称和描述
- 测试数据和结果
- 详细指标 (JSON)
- 测试状态 (pending, running, passed, failed)
- 执行者和时间

**示例查询**:
```sql
-- 特定模型的所有测试
SELECT test_name, test_type, score, status, created_at
FROM models_manager_modeltestresult
WHERE model_id = 1
ORDER BY created_at DESC;

-- 各类型测试的平均分
SELECT 
    test_type,
    AVG(score) as avg_score,
    MAX(score) as max_score,
    MIN(score) as min_score,
    COUNT(*) as test_count
FROM models_manager_modeltestresult
WHERE status = 'passed'
GROUP BY test_type;
```

**索引**: ✅ 已优化
- 模型-时间: `(model_id, -created_at)`
- 测试类型-时间: `(test_type, -created_at)`

### ✅ 用户通知存储

**表**: `users_notification`

存储内容:
- 通知接收者和发起者
- 动作类型 (post_like, post_comment, comment_reply, comment_like, post_favorite)
- 关联的帖子和评论
- 是否已读状态
- 创建时间

**示例查询**:
```sql
-- 用户的未读通知
SELECT 
    action_type, message, created_at,
    CASE 
        WHEN post_id IS NOT NULL THEN CONCAT('Post: ', p.title)
        WHEN comment_id IS NOT NULL THEN 'Comment'
    END as target
FROM users_notification n
LEFT JOIN forum_forumpost p ON n.post_id = p.id
WHERE recipient_id = 1 AND is_read = 0
ORDER BY created_at DESC;
```

### ✅ 文件上传存储

**支持的文件类型**:
- **用户头像**: `users/avatars/%Y/%m/%d/`
- **帖子图片**: `forum/posts/%Y/%m/%d/`
- **评论图片**: `forum/comments/%Y/%m/%d/`
- **附件**: `forum/{user_id}/{uuid}.{ext}`
- **对话图片**: `chat/`

**字段**: 
- `avatar_file` (ImageField) - 用户头像文件
- `image` (ImageField) - 帖子/评论/消息图片
- `attachments` (ForeignKey) - 帖子附件

---

## 🔍 数据库完整性检查

### 检查脚本

运行以下命令验证数据库健全性:

```bash
# 1. 查看所有表
docker exec ai-arena-db-1 mysql -uroot -p123456 aiarena -e "SHOW TABLES;"

# 2. 检查表结构
docker exec ai-arena-db-1 mysql -uroot -p123456 aiarena -e "
SELECT 
    TABLE_NAME, 
    TABLE_ROWS as 'Records',
    ROUND(DATA_LENGTH/1024/1024, 2) as 'Size(MB)'
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'aiarena'
ORDER BY TABLE_NAME;
"

# 3. 检查外键关系
docker exec ai-arena-db-1 mysql -uroot -p123456 aiarena -e "
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'aiarena' AND REFERENCED_TABLE_NAME IS NOT NULL;
"

# 4. 检查孤立数据（评论但帖子不存在）
docker exec ai-arena-db-1 mysql -uroot -p123456 aiarena -e "
SELECT COUNT(*) as orphan_comments
FROM forum_forumcomment c
WHERE c.post_id NOT IN (SELECT id FROM forum_forumpost);
"

# 5. 检查数据库大小
docker exec ai-arena-db-1 mysql -uroot -p123456 aiarena -e "
SELECT 
    ROUND(SUM(DATA_LENGTH + INDEX_LENGTH)/1024/1024, 2) as 'Total Size(MB)'
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'aiarena';
"
```

### 常见问题排查

#### 1. 外键约束错误

**症状**: `Foreign key constraint failed`

**排查**:
```sql
-- 检查孤立数据
SELECT * FROM forum_forumpost WHERE author_id NOT IN (SELECT id FROM users_user);
SELECT * FROM forum_forumcomment WHERE post_id NOT IN (SELECT id FROM forum_forumpost);
```

**解决**: 删除孤立数据或修复关联

#### 2. 唯一约束冲突

**症状**: `Duplicate entry`

**排查**:
```sql
-- 检查重复的收藏记录
SELECT post_id, user_id, COUNT(*) 
FROM forum_forumpostfavorite 
GROUP BY post_id, user_id 
HAVING COUNT(*) > 1;
```

#### 3. 索引缺失

**症状**: 查询速度慢

**验证**:
```sql
-- 查看所有索引
SELECT * FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'aiarena' 
ORDER BY TABLE_NAME, NON_UNIQUE, SEQ_IN_INDEX;
```

---

## 📈 性能优化建议

### 1. 定期维护

```sql
-- 优化表
OPTIMIZE TABLE forum_forumpost, forum_forumcomment;

-- 分析统计信息
ANALYZE TABLE models_manager_aimodel;

-- 检查表完整性
CHECK TABLE users_user, users_notification;
```

### 2. 排行榜快照策略

创建定时任务生成排行榜快照（每日 00:00）:

```python
# backend/models_manager/tasks.py
from celery import shared_task
from .models import AIModel, LeaderboardSnapshot

@shared_task
def create_leaderboard_snapshot():
    """生成每日排行榜快照"""
    models = AIModel.objects.filter(is_active=True).values()
    snapshot = LeaderboardSnapshot.objects.create(
        leaderboard_data=list(models),
        total_models=len(models),
        total_battles=sum(m['total_battles'] for m in models)
    )
    return f"快照 {snapshot.id} 已创建"
```

### 3. 分区策略 (可选)

对于大型表考虑按日期分区:

```sql
-- 按月分区论坛帖子
ALTER TABLE forum_forumpost
PARTITION BY RANGE (YEAR(created_at)*100 + MONTH(created_at)) (
    PARTITION p202501 VALUES LESS THAN (202502),
    PARTITION p202502 VALUES LESS THAN (202503),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

---

## ✅ 数据库健全性检查清单

- [x] 所有必要表已创建
- [x] 外键关系配置正确
- [x] 唯一约束已建立
- [x] 性能索引已添加
- [x] 用户信息可正常存储
- [x] 论坛帖子/评论可正常存储
- [x] 对话记录可正常存储
- [x] 对战投票可正常存储
- [x] 模型排行榜可正常存储
- [x] 测试结果可正常存储
- [x] 文件上传可正常存储
- [x] 通知系统可正常工作

---

## 🔄 备份和恢复

### 备份数据库

```bash
# 完整备份
docker exec ai-arena-db-1 mysqldump -uroot -p123456 aiarena > aiarena_backup_$(date +%Y%m%d_%H%M%S).sql

# 只备份结构
docker exec ai-arena-db-1 mysqldump -uroot -p123456 --no-data aiarena > aiarena_schema.sql

# 只备份数据
docker exec ai-arena-db-1 mysqldump -uroot -p123456 --no-create-info aiarena > aiarena_data.sql
```

### 恢复数据库

```bash
# 从备份恢复
docker exec -i ai-arena-db-1 mysql -uroot -p123456 aiarena < aiarena_backup_20251208.sql
```

---

## 📚 参考资源

- [Django ORM 文档](https://docs.djangoproject.com/en/5.1/topics/db/models/)
- [MySQL 性能优化](https://dev.mysql.com/doc/)
- [数据库设计最佳实践](https://en.wikipedia.org/wiki/Database_design)

---

## 🔧 数据库维护任务

### 定期维护

```bash
# 优化表空间（每月）
docker exec -i ai-arena-db-1 mysql -uroot -p123456 aiarena << 'EOF'
OPTIMIZE TABLE forum_forumpost;
OPTIMIZE TABLE forum_forumcomment;
OPTIMIZE TABLE models_manager_modeltestresult;
OPTIMIZE TABLE models_manager_leaderboardsnapshot;
EOF

# 分析统计信息（每周）
docker exec -i ai-arena-db-1 mysql -uroot -p123456 aiarena << 'EOF'
ANALYZE TABLE forum_forumpost;
ANALYZE TABLE forum_forumcomment;
ANALYZE TABLE models_manager_modeltestresult;
ANALYZE TABLE models_manager_leaderboardsnapshot;
EOF

# 检查表完整性（每月）
docker exec -i ai-arena-db-1 mysql -uroot -p123456 aiarena << 'EOF'
CHECK TABLE users_user, users_notification;
CHECK TABLE forum_forumpost, forum_forumcomment;
CHECK TABLE models_manager_aimodel;
EOF
```

### 备份策略

```bash
# 完整备份（每天）
docker exec ai-arena-db-1 mysqldump -uroot -p123456 aiarena > aiarena_backup_$(date +%Y%m%d_%H%M%S).sql

# 只备份新模型数据（每周）
docker exec ai-arena-db-1 mysqldump -uroot -p123456 aiarena models_manager_modeltestresult models_manager_leaderboardsnapshot > models_backup_$(date +%Y%m%d).sql

# 恢复备份
docker exec -i ai-arena-db-1 mysql -uroot -p123456 aiarena < aiarena_backup_20250115.sql
```

---

## 📊 数据库统计信息

### 表统计

```
总表数: 30
总索引: 57
外键约束: 41
```

### 关键表索引分布

| 表名 | 索引数 | 主要用途 |
|------|--------|---------|
| forum_forumpost | 9 | 论坛帖子查询优化 |
| users_notification | 7 | 用户通知查询 |
| forum_forumcomment | 7 | 评论查询优化 |
| models_manager_modeltestresult | 6 | 模型测试查询 ✨ |
| forum_forumcommentreaction | 5 | 评论反应统计 |
| forum_forumpostfavorite | 5 | 用户收藏查询 |
| forum_forumpostreaction | 5 | 帖子反应统计 |
| forum_forumpostviewhistory | 5 | 浏览历史查询 |

---

## ✅ 健康检查验证结果

**执行时间**: 2025-12-08 10:30:00  
**检查状态**: ✅ ALL PASSED

### 检查项目

- ✅ 核心表完整性：8/8 表存在
- ✅ 新模型表字段：9/9 字段完整
- ✅ 数据库索引：57 个索引已创建
- ✅ 外键约束：41 个约束正常
- ✅ LeaderboardSnapshot 读写：✅ 通过
- ✅ ModelTestResult 读写：✅ 通过
- ✅ 用户记录：5 条
- ✅ 数据完整性：无孤立数据

### 功能验证

所有数据持久化功能已验证并正常运行：

```
✅ 对话记录    - models_manager_chatmessage
✅ 对话会话    - models_manager_chatconversation  
✅ 论坛帖子    - forum_forumpost (9 indexes)
✅ 论坛评论    - forum_forumcomment (7 indexes)
✅ 论坛反应    - forum_forumcommentreaction
✅ 帖子收藏    - forum_forumpostfavorite
✅ 浏览历史    - forum_forumpostviewhistory
✅ 个人信息    - users_user
✅ 用户通知    - users_notification
✅ 排行榜信息  - models_manager_leaderboardsnapshot ✨
✅ 测试结果    - models_manager_modeltestresult ✨
✅ 文件上传    - forum_forumpostimage, forum_forumcommentimage, forum_forumattachment
```

---

**最后更新**: 2025-12-08  
**数据库版本**: MySQL 8.0  
**文档版本**: 2.0 (含新模型表)  
**项目状态**: ✅ 数据库健全且完整
