# 快速测试指南

## PowerShell 命令测试

### 1. 注册用户
```powershell
$body = @{
    username = "testuser"
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method Post -Body $body -ContentType "application/json"
```

### 2. 登录
```powershell
$body = @{
    username = "testuser"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.data.token
Write-Host "Token: $token"
```

### 3. 创建帖子
```powershell
$body = @{
    title = "我的第一篇帖子"
    content = "这是测试内容"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/posts" -Method Post -Body $body -ContentType "application/json" -Headers $headers
```

### 4. 获取所有帖子
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/posts" -Method Get
```

### 5. 获取我的帖子
```powershell
$headers = @{
    "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/posts/user/my" -Method Get -Headers $headers
```

## 使用测试脚本（推荐）

### 方式一：直接运行
```powershell
.\test-api.ps1
```

### 方式二：如果提示执行策略错误
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\test-api.ps1
```

## 在MySQL中验证

```bash
# 连接数据库
mysql -h 127.0.0.1 -P 3306 -u root -p123456

# 查看数据
USE aiarena;
SELECT * FROM users;
SELECT * FROM posts;

# 查看关联数据
SELECT p.*, u.username 
FROM posts p 
LEFT JOIN users u ON p.user_id = u.id;
```

## 使用可视化工具验证

### MySQL Workbench
1. 连接信息：
   - Host: 127.0.0.1
   - Port: 3306
   - Username: root
   - Password: 123456
   - Database: aiarena

2. 查看表：
   - 左侧 Schemas → aiarena → Tables
   - 右键 users → Select Rows
   - 右键 posts → Select Rows

### DBeaver
1. 新建连接 → MySQL
2. 输入连接信息
3. 测试连接 → 完成
4. 展开数据库 → 查看表数据

## 验证清单

- [ ] 注册返回用户信息和token
- [ ] users表中有新用户记录
- [ ] 密码是加密存储的（bcrypt hash）
- [ ] 登录返回token
- [ ] 使用token可以创建帖子
- [ ] posts表中有新帖子记录
- [ ] 帖子和用户正确关联（user_id对应）
- [ ] 可以查询所有帖子
- [ ] 帖子显示了作者用户名
- [ ] 浏览量会自动增加

## 常见问题

### Q: 执行策略错误
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q: 连接被拒绝
检查服务是否运行：
```powershell
npm run dev
# 或
docker-compose up -d
```

### Q: 用户名已存在
更换用户名或删除测试数据：
```sql
DELETE FROM posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'test%');
DELETE FROM users WHERE username LIKE 'test%';
```
