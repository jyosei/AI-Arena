# AI Arena 自动化测试脚本使用指南

> **版本**: 1.0  
> **最后更新**: 2025-12-08  
> **适用范围**: Linux, macOS, Windows  
> **编辑**: shallcheer

快速运行完整的自动化测试套件。

---

## 📑 快速目录

- [开始使用](#开始使用)
- [脚本列表](#脚本列表)
- [测试类型](#测试类型)
- [常见命令](#常见命令)
- [CI/CD 集成](#cicd-集成)

---

## 开始使用

### Linux/macOS 用户

```bash
# 1. 赋予脚本执行权限 (首次运行)
chmod +x scripts/run-tests.sh

# 2. 运行完整测试
./scripts/run-tests.sh 全部

# 3. 运行特定测试
./scripts/run-tests.sh 后端      # 后端测试
./scripts/run-tests.sh 前端      # 前端测试
./scripts/run-tests.sh 数据库    # 数据库测试
```

### Windows 用户

```cmd
REM 直接运行脚本
scripts\run-tests.bat all       REM 完整测试
scripts\run-tests.bat backend   REM 后端测试
scripts\run-tests.bat frontend  REM 前端测试
scripts\run-tests.bat database  REM 数据库测试
```

---

## 脚本列表

### 文件位置

```
scripts/
├── run-tests.sh     # Linux/macOS 自动化测试脚本 (11 KB)
└── run-tests.bat    # Windows 自动化测试脚本 (10 KB)
```

### 脚本特性

✅ 自动检查依赖 (Python、Node.js、npm)  
✅ 自动处理数据库迁移  
✅ 自动安装 npm 依赖  
✅ 彩色输出和进度提示  
✅ 详细的测试总结报告  
✅ 错误处理和异常报告  
✅ 支持部分测试和完整测试  

---

## 测试类型

| 命令 | 说明 | 耗时 |
|------|------|------|
| `全部` | 运行所有测试 | ~5-10 分钟 |
| `后端` | Django/pytest 测试 + 数据库检查 | ~2-3 分钟 |
| `前端` | Jest/ESLint + 生产构建 | ~2-3 分钟 |
| `数据库` | 表、索引、约束验证 | ~1 分钟 |
| `API` | API 服务连接检查 | <1 分钟 |
| `Docker` | 容器状态检查 | <1 分钟 |
| `性能` | 数据库查询性能测试 | ~1 分钟 |

---

## 常见命令

### 基本命令

```bash
# Linux/macOS
./scripts/run-tests.sh 全部
./scripts/run-tests.sh 后端
./scripts/run-tests.sh 前端

# Windows
scripts\run-tests.bat all
scripts\run-tests.bat backend
scripts\run-tests.bat frontend
```

### 与日志输出

```bash
# 保存测试日志
./scripts/run-tests.sh 全部 | tee test-results.log

# 仅显示失败信息
./scripts/run-tests.sh 全部 2>&1 | grep -i error

# 后台运行
nohup ./scripts/run-tests.sh 全部 > test.log 2>&1 &
```

### 定时运行

```bash
# Linux/macOS - 每天晚上 10 点运行
crontab -e
# 添加以下行
0 22 * * * cd /path/to/AI-Arena && bash scripts/run-tests.sh 全部 >> logs/test.log 2>&1

# Windows - 使用任务计划程序
# 1. 打开 "任务计划程序"
# 2. 创建基本任务
# 3. 操作: C:\path\to\scripts\run-tests.bat all
```

---

## CI/CD 集成

### GitHub Actions

`.github/workflows/test.yml`:

```yaml
name: Automated Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: aiarena
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run tests (Linux/macOS)
        if: runner.os != 'Windows'
        run: bash scripts/run-tests.sh 全部
      
      - name: Run tests (Windows)
        if: runner.os == 'Windows'
        run: scripts\run-tests.bat all
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results.log
```

### GitLab CI

`.gitlab-ci.yml`:

```yaml
stages:
  - test

test:backend:
  stage: test
  image: python:3.11
  services:
    - mysql:8.0
  script:
    - apt-get update && apt-get install -y nodejs npm
    - bash scripts/run-tests.sh 全部
  artifacts:
    paths:
      - coverage/
      - test-results.log
    when: always

test:frontend:
  stage: test
  image: node:18
  script:
    - bash scripts/run-tests.sh 前端
  artifacts:
    paths:
      - frontend/dist/
```

### Jenkins

`Jenkinsfile`:

```groovy
pipeline {
    agent any
    
    stages {
        stage('Setup') {
            steps {
                sh 'chmod +x scripts/run-tests.sh'
                sh 'pip install -r backend/requirements.txt'
                sh 'npm install --prefix frontend'
            }
        }
        
        stage('Test') {
            parallel {
                stage('Backend') {
                    steps {
                        sh './scripts/run-tests.sh 后端'
                    }
                }
                stage('Frontend') {
                    steps {
                        sh './scripts/run-tests.sh 前端'
                    }
                }
                stage('Database') {
                    steps {
                        sh './scripts/run-tests.sh 数据库'
                    }
                }
            }
        }
    }
    
    post {
        always {
            junit 'test-results/**/*.xml'
            publishHTML([
                reportDir: 'backend/htmlcov',
                reportFiles: 'index.html',
                reportName: 'Coverage Report'
            ])
        }
    }
}
```

---

## 输出解释

### 成功的测试

```
========================================
AI Arena 自动化测试套件
========================================

测试类型: 全部
项目路径: /Users/chensihan/SEHW/AI-Arena

========================================
运行后端测试
========================================

[INFO] 运行数据库迁移...
[OK] 数据库迁移完成
[INFO] 运行单元测试...
[OK] Django 单元测试通过
[INFO] 运行数据库健康检查...
[OK] 数据库健康检查通过

========================================
运行前端测试
========================================

[INFO] 安装 npm 依赖...
[INFO] 运行 Jest 单元测试...
[OK] Jest 单元测试通过
[INFO] 运行 ESLint 代码检查...
[OK] ESLint 代码检查通过
[INFO] 运行生产构建检查...
[OK] 生产构建成功

========================================
测试总结报告
========================================

通过: 52
失败: 0

✓ 所有测试通过！
```

### 失败的测试

```
[FAIL] Django 单元测试失败
[ERROR] MySQL 连接失败

========================================
测试总结报告
========================================

通过: 48
失败: 4

✗ 存在测试失败
```

---

## 故障排除

### 问题 1: 脚本权限错误

```
bash: ./scripts/run-tests.sh: Permission denied
```

**解决方案**:
```bash
chmod +x scripts/run-tests.sh
./scripts/run-tests.sh 全部
```

### 问题 2: Python/npm 未找到

```
Python 未安装
npm 未安装
```

**解决方案**:
```bash
# 安装 Python (macOS)
brew install python3

# 安装 Node.js (macOS)
brew install node

# 验证安装
python3 --version
npm --version
```

### 问题 3: 数据库连接失败

```
[FAIL] MySQL 连接失败
```

**解决方案**:
```bash
# 检查 MySQL 状态
ps aux | grep mysql

# 启动 MySQL (macOS)
brew services start mysql

# 检查数据库配置
cat backend/.env | grep DATABASE

# 手动连接测试
mysql -u root -p -h 127.0.0.1
```

### 问题 4: npm 依赖问题

```
npm ERR! code E401
npm ERR! 401 Unauthorized
```

**解决方案**:
```bash
# 清空缓存
npm cache clean --force

# 删除 node_modules
rm -rf frontend/node_modules package-lock.json

# 重新安装
npm install --legacy-peer-deps
```

### 问题 5: 端口被占用

```
Port 8000 already in use
```

**解决方案**:
```bash
# Linux/macOS - 查找占用端口的进程
lsof -i :8000

# 杀死进程
kill -9 <PID>

# Windows - 查找占用端口的进程
netstat -ano | findstr :8000

# 杀死进程
taskkill /PID <PID> /F
```

---

## 性能优化建议

### 加速后端测试

```bash
# 并行运行测试
python manage.py test --parallel

# 跳过迁移
python manage.py test --keepdb

# 只运行特定应用的测试
python manage.py test users forum
```

### 加速前端测试

```bash
# 跳过覆盖率报告
npm run test -- --coverage=false

# 只运行有改动的测试
npm run test -- --onlyChanged

# 仅监视模式
npm run test -- --watch
```

---

## 高级选项

### 自定义脚本参数

编辑脚本文件调整以下参数：

**run-tests.sh**:
```bash
# 修改超时时间
TIMEOUT=30

# 修改测试目录
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
```

**run-tests.bat**:
```batch
REM 修改 Python 可执行文件
set PYTHON_EXE=python3

REM 修改 npm 命令
set NPM_CMD=npm
```

### 扩展脚本

在 `run_*_tests()` 函数中添加自定义逻辑：

```bash
# 添加自定义测试步骤
run_custom_tests() {
    print_header "运行自定义测试"
    
    # 你的自定义测试命令
    custom_test_command
    
    if [ $? -eq 0 ]; then
        print_success "自定义测试通过"
    else
        print_error "自定义测试失败"
        return 1
    fi
}
```

---

## 最佳实践

✅ **在每次提交前运行测试**
```bash
./scripts/run-tests.sh 全部
```

✅ **在 PR 中启用自动测试**
使用 GitHub Actions 或 GitLab CI 进行自动化测试

✅ **定期运行性能测试**
```bash
./scripts/run-tests.sh 性能
```

✅ **保存测试日志**
```bash
./scripts/run-tests.sh 全部 | tee logs/test-$(date +%Y%m%d).log
```

✅ **监控测试结果趋势**
使用 CI/CD 平台的报表功能追踪测试结果

---

**版本**: 1.0  
**最后更新**: 2025-12-08  
**脚本数量**: 2 (sh + bat)  
**支持的操作系统**: Windows, macOS, Linux  
**项目状态**: ✅ AUTOMATION READY
