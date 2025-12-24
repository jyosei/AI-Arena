# 快速参考

常用命令和操作的快速参考指南。

> 编辑: shallcheer

## Docker 命令

### 启动和停止

```bash
# 启动所有服务
docker compose up -d

# 启动并重新构建
docker compose up --build -d

# 停止所有服务
docker compose down

# 停止并删除数据卷
docker compose down -v

# 重启特定服务
docker compose restart backend
docker compose restart frontend
```

### 查看状态和日志

```bash
# 查看容器状态
docker compose ps

# 查看所有日志
docker compose logs

# 跟踪日志（实时）
docker compose logs -f

# 查看特定服务日志
docker compose logs backend
docker compose logs -f backend --tail 100

# 查看资源使用
docker stats
```

### 进入容器

```bash
# 进入后端容器
docker exec -it ai-arena-backend-1 bash

# 进入数据库容器
docker exec -it ai-arena-db-1 bash

# 进入前端容器
docker exec -it ai-arena-frontend-1 sh
```

## Django 命令

### 数据库操作

```bash
# 创建迁移
docker exec ai-arena-backend-1 python manage.py makemigrations

# 应用迁移
docker exec ai-arena-backend-1 python manage.py migrate

# 创建超级用户
docker exec -it ai-arena-backend-1 python manage.py createsuperuser

# 进入 Django Shell
docker exec -it ai-arena-backend-1 python manage.py shell
```

### 数据管理

```bash
# 导出数据
docker exec ai-arena-backend-1 python manage.py dumpdata > data.json

# 导入数据
docker exec -i ai-arena-backend-1 python manage.py loaddata < data.json

# 清空数据库（危险！）
docker exec ai-arena-backend-1 python manage.py flush
```

## MySQL 命令

### 数据库操作

```bash
# 连接到数据库
docker exec -it ai-arena-db-1 mysql -uroot -p123456 aiarena

# 备份数据库
docker exec ai-arena-db-1 mysqldump -uroot -p123456 aiarena > backup.sql

# 恢复数据库
docker exec -i ai-arena-db-1 mysql -uroot -p123456 aiarena < backup.sql

# 执行 SQL 命令
docker exec ai-arena-db-1 mysql -uroot -p123456 -e "USE aiarena; SHOW TABLES;"
```

### 常用查询

```sql
-- 用户统计
SELECT COUNT(*) FROM users_user;

-- 帖子统计
SELECT 
    COUNT(*) as total_posts,
    SUM(view_count) as total_views,
    SUM(like_count) as total_likes
FROM forum_forumpost;

-- 最活跃用户
SELECT 
    u.username,
    COUNT(p.id) as post_count
FROM users_user u
LEFT JOIN forum_forumpost p ON u.id = p.author_id
GROUP BY u.id
ORDER BY post_count DESC
LIMIT 10;

-- 最热门帖子
SELECT 
    title,
    view_count,
    like_count,
    comment_count
FROM forum_forumpost
ORDER BY like_count DESC
LIMIT 10;
```

## Git 命令

### 常用操作

```bash
# 查看状态
git status

# 添加文件
git add .
git add specific-file.py

# 提交
git commit -m "feat: add new feature"

# 推送
git push origin main

# 拉取
git pull origin main

# 创建分支
git checkout -b feature/new-feature

# 切换分支
git checkout main

# 合并分支
git merge feature/new-feature

# 查看日志
git log --oneline --graph
```

### 撤销操作

```bash
# 撤销工作区修改
git checkout -- file.py

# 撤销暂存区
git reset HEAD file.py

# 撤销最后一次提交（保留更改）
git reset --soft HEAD^

# 撤销最后一次提交（不保留更改）
git reset --hard HEAD^
```

## 测试命令

### API 测试

```bash
# 注册用户
curl -X POST http://82.157.56.206/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123"}'

# 登录
curl -X POST http://82.157.56.206/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123"}'

# 获取用户资料（需要 token）
curl http://82.157.56.206/api/users/profile/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# 创建帖子
curl -X POST http://82.157.56.206/api/forum/posts/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Content","status":"published"}'
```

### 运行测试

```bash
# Django 测试
docker exec ai-arena-backend-1 python manage.py test

# 特定应用测试
docker exec ai-arena-backend-1 python manage.py test users
docker exec ai-arena-backend-1 python manage.py test forum

# 前端构建测试
cd frontend && npm run build
```

## 清理命令

### Docker 清理

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的数据卷
docker volume prune

# 清理所有未使用资源
docker system prune -a

# 查看 Docker 占用空间
docker system df
```

### 项目清理

```bash
# 清理 Python 缓存
find . -type d -name __pycache__ -exec rm -r {} +
find . -type f -name "*.pyc" -delete

# 清理 Node.js 依赖
rm -rf node_modules
rm -rf frontend/node_modules

# 清理构建文件
rm -rf frontend/dist
rm -rf frontend/build
```

## 环境变量

### 查看环境变量

```bash
# 查看后端环境变量
docker exec ai-arena-backend-1 env | grep DB

# 查看前端环境变量
docker exec ai-arena-frontend-1 env
```

## 性能监控

```bash
# 查看容器资源使用
docker stats

# 查看特定容器
docker stats ai-arena-backend-1

# 查看进程
docker top ai-arena-backend-1
```

## 故障排查

### 容器无法启动

```bash
# 查看容器日志
docker logs ai-arena-backend-1

# 查看最后 100 行
docker logs --tail 100 ai-arena-backend-1

# 实时跟踪
docker logs -f ai-arena-backend-1
```

### 数据库连接问题

```bash
# 测试数据库连接
docker exec ai-arena-backend-1 python manage.py dbshell

# 检查数据库状态
docker exec ai-arena-db-1 mysqladmin -uroot -p123456 status

# 重启数据库
docker compose restart db
```

### 端口冲突

```bash
# 查看端口占用
lsof -i :8000
lsof -i :3306

# 停止占用端口的进程
kill -9 PID
```

## 文件路径

### 重要配置文件

```
AI-Arena/
├── docker-compose.yml          # Docker 编排配置
├── .env                        # 环境变量
├── backend/
│   ├── manage.py              # Django 管理脚本
│   ├── requirements.txt       # Python 依赖
│   ├── ai_arena_backend/
│   │   └── settings.py        # Django 配置
│   └── */urls.py              # 路由配置
└── frontend/
    ├── package.json           # Node.js 依赖
    ├── vite.config.js         # Vite 配置
    ├── nginx.conf             # Nginx 配置
    └── src/
        ├── api/apiClient.js   # API 客户端
        └── contexts/          # React Context
```

## 常用 URL

- **前端**: http://82.157.56.206
- **API**: http://82.157.56.206/api/
- **Django Admin**: http://82.157.56.206/admin/
- **API 文档**: http://82.157.56.206/api/docs/ (如果配置)

## 快速修复

### 重置整个环境

```bash
# 停止并删除所有容器和数据卷
docker compose down -v

# 重新构建并启动
docker compose up --build -d

# 等待数据库启动
sleep 10

# 应用迁移
docker exec ai-arena-backend-1 python manage.py migrate

# 创建超级用户
docker exec -it ai-arena-backend-1 python manage.py createsuperuser
```

### 仅重置数据库

```bash
# 删除数据库
docker exec ai-arena-db-1 mysql -uroot -p123456 -e "DROP DATABASE aiarena; CREATE DATABASE aiarena CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 重新应用迁移
docker exec ai-arena-backend-1 python manage.py migrate
```

---

**提示**: 将常用命令添加到 shell 别名或脚本中可以提高效率！

```bash
# ~/.bashrc 或 ~/.zshrc
alias dc="docker compose"
alias dcu="docker compose up -d"
alias dcd="docker compose down"
alias dcl="docker compose logs -f"
alias dcb="docker exec -it ai-arena-backend-1"
alias dcd="docker exec -it ai-arena-db-1 mysql -uroot -p123456 aiarena"
```
