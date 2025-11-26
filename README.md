# AI-Arena
软件学院2025-2026学年秋季学期软件工程小组大作业

## 数据库配置

### 1. 安装MySQL

确保已安装MySQL 8.0或更高版本。

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置数据库连接：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置数据库密码等参数。

### 3. 初始化数据库

```bash
npm run db:setup
```

### 4. MySQL可视化工具

推荐使用以下工具进行数据库可视化管理：

#### MySQL Workbench（官方工具）
- 下载地址：https://dev.mysql.com/downloads/workbench/
- 功能全面，支持数据库设计、查询、管理
- 免费开源

#### DBeaver（通用数据库工具）
- 下载地址：https://dbeaver.io/download/
- 支持多种数据库，界面友好
- 免费社区版

#### phpMyAdmin（Web界面）
- 下载地址：https://www.phpmyadmin.net/
- 基于Web的管理工具
- 需要配置Web服务器

#### Navicat（商业工具）
- 下载地址：https://www.navicat.com.cn/
- 界面精美，功能强大
- 付费软件（有试用期）

#### 连接配置
- Host: localhost (或 .env 中配置的地址)
- Port: 3306
- Username: root (或 .env 中配置的用户名)
- Password: 你的数据库密码
- Database: ai_arena
