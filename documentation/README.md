````markdown
# AI-Arena 🤖

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

使用 Docker Compose 一键启动所有服务：

```bash
docker compose up --build -d
```

服务启动后：
- 前端：http://82.157.56.206
- 后端 API：http://82.157.56.206/api/
- 数据库：localhost:3306

### 4. 初始化数据（可选）

如果需要创建管理员账号：

```bash
docker exec -it ai-arena-backend-1 python manage.py createsuperuser
```

访问 Django 管理后台：http://82.157.56.206/admin/

### 5. 停止服务

```bash
docker compose down
```

## 📁 项目结构

```text
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
├── docs/                  # 文档目录（详细技术文档）
│   ├── API.md            # API 文档
│   ├── DEPLOYMENT.md     # 部署指南
│   └── TESTING.md        # 测试指南
│
├── documentation/         # 项目级别聚合文档（已整理）
│
├── tests/                 # 测试脚本与测试文档（已整理）
│
├── docker-compose.yml     # Docker Compose 配置
└── README.md             # 项目说明 (migrated to documentation/README.md)
```

## 🧪 开发指南

详细的开发和测试指南请参考：
- [API 文档](docs/API.md)
- [部署指南](docs/DEPLOYMENT.md)
- [测试指南](docs/TESTING.md)

## 🔒 安全配置

⚠️ **生产环境部署前请务必修改以下配置：**

1. 修改 `docker-compose.yml` 中的数据库密码
2. 配置有效的 `OPENAI_API_KEY`
3. 配置 GitHub OAuth 应用（如需 GitHub 登录）
4. 修改 Django 的 `SECRET_KEY`
5. 设置 `DEBUG=False`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

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

````
