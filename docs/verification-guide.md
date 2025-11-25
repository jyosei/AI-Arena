# 数据库功能验证指南

## 准备工作

### 1. 确保服务运行
```bash
# 启动Docker MySQL
docker-compose up -d db

# 初始化数据库
npm run db:setup

# 安装依赖
npm install

# 启动服务器
npm run dev
```

## 验证步骤

### 方式一：使用curl命令

#### 1. 注册账号
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

**预期结果：**
```json
{
  "message": "注册成功",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "rating": 1000,
      "wins": 0,
      "losses": 0,
      "draws": 0
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 2. 登录账号
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser\",\"password\":\"password123\"}"
```

**保存返回的token，后续需要使用！**

#### 3. 创建帖子（替换YOUR_TOKEN）
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{\"title\":\"我的第一篇帖子\",\"content\":\"这是测试内容\"}"
```

**预期结果：**
```json
{
  "message": "发帖成功",
  "data": {
    "id": 1,
    "user_id": 1,
    "title": "我的第一篇帖子",
    "content": "这是测试内容",
    "likes": 0,
    "views": 0,
    "username": "testuser"
  }
}
```

#### 4. 查看所有帖子
```bash
curl http://localhost:3000/api/posts
```

### 方式二：使用MySQL客户端验证

#### 1. 连接数据库
```bash
mysql -h 127.0.0.1 -P 3306 -u root -p
# 密码: 123456
```

#### 2. 查询用户表
```sql
USE aiarena;
SELECT * FROM users;
```

**应该看到：**
