# AI-Arena 🤖 Ver 1.0.0 Completed

软件学院 2025-2026 学年秋季学期软件工程大作业

AI-Arena 是一个基于 Web 的 AI 模型对战和交流平台，用户可以在平台上对比不同 AI 模型的表现、参与社区讨论、管理 AI 模型等。

## 🌟 主要功能

- **AI 模型对战**：同时向两个不同的 AI 模型提问，对比它们的回答质量
- **模型排行榜**：基于用户投票和对战结果的模型排名系统
- **论坛社区**：用户可以发帖、评论、点赞、收藏，分享 AI 使用经验
- **用户系统**：注册、登录、个人资料管理、通知系统
- **对话管理**：保存和管理与 AI 的对话历史
- **GitHub OAuth**：支持 GitHub 账号登录

## 🛠️ 技术栈

### 前端
- **React 18** + **Vite** - 现代化前端框架
- **Ant Design** - UI 组件库
- **React Router** - 路由管理
- **Axios** - HTTP 客户端

### 后端
- **Django 5.1** + **Django REST Framework** - Python Web 框架
- **MySQL 8.0** - 关系型数据库
- **JWT** - 身份认证
- **Pillow** - 图片处理

### 部署
- **Docker** + **Docker Compose** - 容器化部署
- **Nginx** - 反向代理和静态文件服务

## 📦 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+

### 1. 克隆项目

```bash
git clone https://github.com/jyosei/AI-Arena.git
cd AI-Arena
```

### 2. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量（特别是 OpenAI API Key）。

### 3. 启动服务

使用 Docker Compose 一键启动所有服务（在服务器环境下可能需要 `sudo`）：

```bash
sudo docker compose up -d --build
```

服务启动后（以仓库当前配置为准）：
- 前端：`http://www.ai-arena.cn` 或服务器 IP（前端通过 Nginx 对外提供，映射到主机 `:80`）
- 后端 API（容器内监听）：`http://<backend>:8000/api/`，对外通过 Nginx 代理到 `/api/`
- 数据库（MySQL）：主机或容器的 `3306`，以 `docker-compose.yml` 配置为准

### 4. 初始化与管理命令（可选）

进入后端容器并运行管理命令：

```bash
# 交互 shell
docker compose exec backend bash

# 创建管理员
python manage.py createsuperuser

# （清理开发/测试数据）查看 dry-run
python manage.py clear_test_data --dry-run
# 确认删除
python manage.py clear_test_data --confirm
```

访问 Django 管理后台（通过 Nginx 代理）： `http://www.ai-arena.cn/admin/`

### 5. 停止服务

```bash
docker compose down
```

## 📁 项目结构

```
AI-Arena/
├── frontend/               # React 前端应用
│   ├── src/
│   │   ├── api/           # API 客户端
│   │   ├── components/    # React 组件
│   │   ├── contexts/      # Context API
│   │   ├── pages/         # 页面组件
│   │   └── utils/         # 工具函数
│   ├── Dockerfile
│   └── nginx.conf         # Nginx 配置
│
├── backend/               # Django 后端应用
│   ├── ai_arena_backend/  # Django 项目配置
│   ├── users/             # 用户模块
│   ├── forum/             # 论坛模块
│   ├── models_manager/    # AI 模型管理模块
│   ├── chat/              # 对话模块
│   ├── datasets/          # 数据集模块
│   ├── media/             # 媒体文件存储
│   └── requirements.txt   # Python 依赖
│
├── docs/                  # 文档目录
│   ├── API.md            # API 文档
│   ├── DEPLOYMENT.md     # 部署指南
│   └── TESTING.md        # 测试指南
│
├── docker-compose.yml     # Docker Compose 配置
└── README.md             # 项目说明
```

## 🧪 开发与测试指南

详细的开发和测试指南请参考仓库中的文档：
- `docs/API.md`
- `docs/DEPLOYMENT.md`
- `docs/TESTING.md`

本地开发注意点：前端 `api` 请求基准路径为 `/api/`，由 Nginx 代理到 Django 后端；若在本地调试前端，可以把 `apiClient` 的 `baseURL` 指向后端地址或启动 proxy。

## 🔒 安全与生产部署注意事项

部署到生产前务必确认并修改以下配置：

1. 在 `docker-compose.yml` 中设置安全的数据库密码和 secret
2. 设置并保护 `OPENAI_API_KEY`、`GITHUB_CLIENT_SECRET` 等敏感凭证（不要提交到仓库）
3. 配置 GitHub OAuth App 的 `Authorization callback URL` 与容器中 `GITHUB_REDIRECT_URI` 完全一致
4. 在 `backend/ai_arena_backend/settings.py` 中设置安全的 `SECRET_KEY` 并把 `DEBUG=False`
5. 使用 HTTPS（配置 Nginx + Let’s Encrypt）并把 `CSRF_COOKIE_SECURE=True` / `SESSION_COOKIE_SECURE=True`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！请在贡献前阅读仓库内的 `CONTRIBUTING.md`（如有）。

## 📄 许可证

本项目仅用于学习和研究目的。

## 👥 团队成员

软件学院 2025-2026 学年秋季学期软件工程小组

- 徐一凯
- 杜文煜
- 王天宇
- 陈思涵

---

**Happy Coding! 🚀**
