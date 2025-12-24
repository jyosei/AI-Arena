# 部署指南

本文档介绍如何在不同环境下部署 AI-Arena 项目。

> 编辑: shallcheer

## 目录

- [Docker 部署（推荐）](#docker-部署推荐)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [常见问题](#常见问题)

---

## Docker 部署（推荐）

Docker 部署是最简单的部署方式，适合开发和生产环境。

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+

### 部署步骤

#### 1. 克隆项目

```bash
git clone https://github.com/jyosei/AI-Arena.git
cd AI-Arena
```

#### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

```env
# 数据库配置
DB_NAME=aiarena
DB_USER=root
DB_PASSWORD=your_secure_password  # 修改为强密码
DB_HOST=db
DB_PORT=3306

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key  # 必填

# GitHub OAuth（可选）
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://82.157.56.206/api/users/github/callback/

# 前端地址
FRONTEND_URL=http://82.157.56.206

# JWT（生产环境必须修改）
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_EXPIRES_IN=7d
```

#### 3. 修改 docker-compose.yml（生产环境）

生产环境部署时，需要修改 `docker-compose.yml` 中的敏感信息：

```yaml
services:
  db:
    environment:
      MYSQL_ROOT_PASSWORD: 'your_secure_password'  # 使用强密码
      
  backend:
    environment:
      DB_PASSWORD: 'your_secure_password'  # 与上面一致
      # 其他环境变量从 .env 读取
```

#### 4. 启动服务

```bash
# 构建并启动所有服务
docker compose up --build -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

#### 5. 初始化数据

```bash
# 创建管理员账号
docker exec -it ai-arena-backend-1 python manage.py createsuperuser

# 进入 Django shell（可选）
docker exec -it ai-arena-backend-1 python manage.py shell
```

#### 6. 访问应用

- 前端：http://82.157.56.206
- Django Admin：http://82.157.56.206/admin/
- API：http://82.157.56.206/api/

#### 7. 停止服务

```bash
# 停止服务
docker compose down

# 停止并删除数据卷（⚠️ 会删除数据库数据）
docker compose down -v
```

### Docker 服务架构

```
┌─────────────────────────────────────────────────────┐
│                   Nginx (Port 80)                   │
│            frontend 容器 (ai-arena-frontend-1)       │
└────────────┬─────────────────────┬──────────────────┘
             │                     │
             │ /api/*             │ /media/*
             ↓                     ↓
    ┌────────────────────┐  ┌──────────────────┐
    │   Backend Django   │  │   Media Files    │
    │ (Port 8000)        │  │                  │
    │ ai-arena-backend-1 │  │                  │
    └─────────┬──────────┘  └──────────────────┘
              │
              │ MySQL Connection
              ↓
    ┌─────────────────────┐
    │   MySQL Database    │
    │   (Port 3306)       │
    │   ai-arena-db-1     │
    └─────────────────────┘
```

---

## 开发环境部署

如果不使用 Docker，可以手动配置开发环境。

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build
```

前端会运行在 http://localhost:5173

### 后端开发

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置数据库（确保 MySQL 已安装并运行）
# 编辑 ai_arena_backend/settings.py 中的数据库配置

# 运行迁移
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser

# 运行开发服务器
python manage.py runserver
```

后端会运行在 http://localhost:8000

### 数据库配置

确保 MySQL 8.0+ 已安装并运行：

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE aiarena CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 生产环境部署

### 1. 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+
- **CPU**: 2核+
- **内存**: 4GB+
- **磁盘**: 20GB+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### 2. 安全配置清单

#### ✅ 环境变量

- [ ] 修改数据库密码（强密码）
- [ ] 配置有效的 OPENAI_API_KEY
- [ ] 修改 JWT_SECRET（使用随机字符串）
- [ ] 配置 GitHub OAuth（如需要）
- [ ] 设置正确的 FRONTEND_URL

#### ✅ Django 配置

编辑 `backend/ai_arena_backend/settings.py`：

```python
# 生产环境必须设置为 False
DEBUG = False

# 配置允许的域名
ALLOWED_HOSTS = ['your-domain.com', 'www.your-domain.com']

# 修改 SECRET_KEY（使用强随机密钥）
SECRET_KEY = 'your-production-secret-key'

# 配置 CORS
CORS_ALLOWED_ORIGINS = [
    "https://your-domain.com",
]
```

#### ✅ Nginx 配置

如果使用自己的 Nginx（不用容器内的），配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 配置 HTTPS

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com
```

### 4. 配置防火墙

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 5. 设置自动重启

创建 systemd 服务或使用 Docker 的重启策略：

```yaml
# docker-compose.yml
services:
  backend:
    restart: unless-stopped
  
  frontend:
    restart: unless-stopped
  
  db:
    restart: unless-stopped
```

### 6. 备份策略

#### 数据库备份

```bash
# 手动备份
docker exec ai-arena-db-1 mysqldump -uroot -p123456 aiarena > backup_$(date +%Y%m%d).sql

# 设置定时备份（crontab）
0 2 * * * docker exec ai-arena-db-1 mysqldump -uroot -pYOUR_PASSWORD aiarena > /backups/db_$(date +\%Y\%m\%d).sql
```

#### 媒体文件备份

```bash
# 备份上传的文件
tar -czf media_backup_$(date +%Y%m%d).tar.gz backend/media/
```

### 7. 监控和日志

```bash
# 查看容器状态
docker compose ps

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 查看资源使用
docker stats

# 清理日志
docker compose logs --tail 1000 > logs.txt
docker system prune -a
```

---

## 常见问题

### Q1: 后端容器启动失败

**症状**: `ai-arena-backend-1` 容器不断重启

**原因**: 通常是数据库迁移失败

**解决方案**:

```bash
# 查看详细错误
docker logs ai-arena-backend-1

# 手动运行迁移
docker exec -it ai-arena-backend-1 python manage.py migrate

# 如果迁移冲突，清空数据库（⚠️ 会丢失数据）
docker exec ai-arena-db-1 mysql -uroot -p123456 -e "DROP DATABASE aiarena; CREATE DATABASE aiarena CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
docker compose restart backend
```

### Q2: 无法访问 API

**症状**: 前端显示网络错误

**检查步骤**:

1. 确认所有容器运行正常：`docker compose ps`
2. 检查 Nginx 配置：`docker exec ai-arena-frontend-1 cat /etc/nginx/conf.d/default.conf`
3. 测试后端连接：`curl http://localhost:8000/api/users/profile/`

### Q3: 图片上传失败

**原因**: 媒体文件目录权限问题

**解决方案**:

```bash
# 进入后端容器
docker exec -it ai-arena-backend-1 bash

# 检查权限
ls -la media/

# 修复权限
chmod -R 755 media/
chown -R root:root media/
```

### Q4: 数据库连接超时

**解决方案**:

```bash
# 检查数据库容器状态
docker logs ai-arena-db-1

# 重启数据库
docker compose restart db

# 等待数据库启动后重启后端
sleep 10
docker compose restart backend
```

### Q5: Docker 镜像拉取超时

**原因**: Docker Hub 访问受限

**解决方案**: 使用国内镜像源或配置代理

```bash
# 修改 Docker daemon 配置
sudo nano /etc/docker/daemon.json

# 添加镜像源
{
  "registry-mirrors": [
    "https://mirror.gcr.io"
  ]
}

# 重启 Docker
sudo systemctl restart docker
```

### Q6: 端口冲突

**症状**: `Error: bind: address already in use`

**解决方案**:

```bash
# 查看端口占用
sudo lsof -i :8000
sudo lsof -i :3306

# 停止占用端口的服务或修改 docker-compose.yml 中的端口映射
```

---

## 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_post_created ON forum_forumpost(created_at);
CREATE INDEX idx_post_author ON forum_forumpost(author_id);

-- 配置 MySQL
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
```

### 2. 静态文件优化

使用 CDN 托管静态文件：

```python
# settings.py
STATIC_URL = 'https://cdn.your-domain.com/static/'
MEDIA_URL = 'https://cdn.your-domain.com/media/'
```

### 3. 缓存配置

```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://redis:6379/1',
    }
}
```

---

## 维护建议

- 定期更新依赖包（安全补丁）
- 监控磁盘空间和数据库大小
- 设置日志轮转
- 定期备份数据
- 监控服务健康状态

---

需要更多帮助？请联系开发团队或提交 Issue。
