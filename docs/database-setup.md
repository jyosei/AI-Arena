# MySQL数据库配置指南

## 问题：Access denied for user 'root'@'172.18.0.1'

这个错误表示MySQL拒绝了连接。可能的原因和解决方案：

## 解决方案

### 1. 检查MySQL服务是否运行

**Windows:**
```bash
# 检查服务状态
services.msc

# 或使用命令行
net start MySQL80
```

**Linux/Mac:**
```bash
# 检查服务状态
sudo systemctl status mysql

# 启动服务
sudo systemctl start mysql
```

### 2. 重置root密码

**方法1: 使用MySQL命令行**
```bash
# 登录MySQL
mysql -u root -p

# 修改密码
ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_new_password';
FLUSH PRIVILEGES;
```

**方法2: 如果忘记密码**
```bash
# 停止MySQL服务
# Windows: net stop MySQL80
# Linux: sudo systemctl stop mysql

# 以安全模式启动
mysqld --skip-grant-tables

# 新开终端，登录并修改密码
mysql -u root
USE mysql;
UPDATE user SET authentication_string=PASSWORD('your_new_password') WHERE User='root';
FLUSH PRIVILEGES;
exit;

# 重启MySQL正常模式
```

### 3. 配置.env文件

确保.env文件存在并配置正确：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=ai_arena
```

**注意事项：**
- IP地址172.18.0.1表示可能在使用Docker
- 如果使用Docker，请使用 `127.0.0.1` 或 `host.docker.internal`
- 确保密码中没有特殊字符或使用引号包裹

### 4. 创建新用户（推荐）

不建议在生产环境使用root用户：

```sql
-- 登录MySQL
mysql -u root -p

-- 创建新用户
CREATE USER 'ai_arena_user'@'localhost' IDENTIFIED BY 'strong_password';

-- 授予权限
GRANT ALL PRIVILEGES ON ai_arena.* TO 'ai_arena_user'@'localhost';
FLUSH PRIVILEGES;
```

然后更新.env：
```env
DB_USER=ai_arena_user
DB_PASSWORD=strong_password
```

### 5. Docker环境配置

如果使用Docker运行MySQL：

```yaml
# docker-compose.yml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: ai_arena
      MYSQL_USER: ai_arena_user
      MYSQL_PASSWORD: user_password
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

对应的.env配置：
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ai_arena_user
DB_PASSWORD=user_password
DB_NAME=ai_arena
```

### 6. 测试连接

运行测试脚本：
```bash
npm run db:setup
```

如果仍有问题，手动测试：
```bash
mysql -h localhost -P 3306 -u root -p
```

## 常见错误

| 错误代码 | 说明 | 解决方案 |
|---------|------|---------|
| ER_ACCESS_DENIED_ERROR | 用户名或密码错误 | 检查.env配置，重置密码 |
| ECONNREFUSED | 无法连接到MySQL | 检查MySQL服务是否运行 |
| ER_BAD_DB_ERROR | 数据库不存在 | 运行初始化脚本创建数据库 |

## 验证配置

成功配置后，应该看到：
