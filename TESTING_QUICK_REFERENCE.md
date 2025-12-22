# 测试快速参考

快速查阅如何运行各类测试。

## 🚀 快速命令

### 运行所有测试

```bash
# 方法1：后端全量测试
cd backend
python manage.py test test_suite --verbosity=2

# 方法2：使用测试运行器
python run_comprehensive_tests.py

# 方法3：npm 脚本
npm run test:all

# 方法4：shell 脚本
bash run-comprehensive-tests.sh
```

### 运行特定类别

```bash
# 单元测试
cd backend && python run_comprehensive_tests.py --unit

# 集成测试
cd backend && python run_comprehensive_tests.py --integration

# 端到端测试
cd backend && python run_comprehensive_tests.py --e2e

# 性能测试
cd backend && python run_comprehensive_tests.py --performance

# 错误处理测试
cd backend && python run_comprehensive_tests.py --errors

# 并发测试
cd backend && python run_comprehensive_tests.py --concurrency

# 快速测试（跳过性能）
cd backend && python run_comprehensive_tests.py --quick
```

### 带代码覆盖率

```bash
# 生成覆盖率报告
cd backend
coverage run --source='.' manage.py test test_suite
coverage report
coverage html  # 生成HTML报告

# 查看HTML报告
open htmlcov/index.html
```

### 前端测试

```bash
# 运行前端端到端测试
node test-e2e.js

# 使用npm脚本
npm run test:e2e
```

## 📝 运行特定测试

### 运行单个测试类

```bash
cd backend
python manage.py test test_suite.UserModelTests
python manage.py test test_suite.ForumIntegrationTests
```

### 运行单个测试方法

```bash
python manage.py test test_suite.UserModelTests.test_create_user
python manage.py test test_suite.ForumIntegrationTests.test_create_post
```

### 运行并停止在第一个失败处

```bash
python manage.py test test_suite --failfast
```

### 详细输出

```bash
python manage.py test test_suite --verbosity=2
```

## 🐳 Docker 中运行

```bash
# 运行所有测试
docker exec ai-arena-backend-1 python manage.py test test_suite

# 运行特定测试
docker exec ai-arena-backend-1 python manage.py test test_suite.UserModelTests

# 使用coverage
docker exec ai-arena-backend-1 coverage run --source='.' manage.py test test_suite
docker exec ai-arena-backend-1 coverage report
```

## 🔍 测试文件位置

| 文件 | 用途 |
|-----|------|
| `backend/test_suite.py` | 所有后端测试用例 |
| `backend/run_comprehensive_tests.py` | Python 测试运行器 |
| `test-e2e.js` | 前端端到端测试 |
| `run-comprehensive-tests.sh` | Shell 测试运行脚本 |
| `.github/workflows/tests.yml` | GitHub Actions CI 配置 |
| `docs/COMPREHENSIVE_TESTING.md` | 完整测试文档 |

## 📊 测试覆盖范围

### 后端测试数量

```
单元测试:          15 个测试
集成测试:          25 个测试
端到端测试:        2 个完整流程
性能测试:          3 个场景
错误处理测试:      3 个场景
并发测试:          2 个场景
————————————
总计:              50+ 个测试用例
```

### 前端测试覆盖

```
认证: 3 个测试
资料: 3 个测试
论坛: 8 个测试
点赞: 2 个测试
评论: 3 个测试
关注: 3 个测试
删除: 1 个测试
性能: 2 个测试
错误: 3 个测试
————————————
总计: 28 个测试用例
```

## ⚡ 常见使用场景

### 场景1：提交 PR 前运行测试

```bash
# 快速验证
cd backend && python run_comprehensive_tests.py --quick

# 或者
npm run test:quick
```

### 场景2：修改后验证某个模块

```bash
# 修改用户模块后
python manage.py test test_suite.UserModelTests \
                       test_suite.UserProfileIntegrationTests

# 修改论坛模块后
python manage.py test test_suite.ForumPostTests \
                       test_suite.ForumIntegrationTests
```

### 场景3：完整验证

```bash
# 在发布前进行完整验证
bash run-comprehensive-tests.sh

# 或者
npm run test:all
```

### 场景4：检查代码覆盖率

```bash
cd backend
coverage run --source='.' manage.py test test_suite
coverage report -m  # 显示缺失的行
coverage html       # 生成详细HTML报告
```

## 🔧 调试失败的测试

### 查看完整错误

```bash
python manage.py test test_suite.FailingTest --verbosity=2
```

### 保留测试数据库

```bash
# 运行测试并保留数据库
python manage.py test test_suite --keepdb

# 然后查询数据库
python manage.py dbshell --database=test_default
```

### 在测试中添加断点

```python
def test_something(self):
    import pdb; pdb.set_trace()  # 会暂停执行
    # 输入 c 继续，h 查看帮助，q 退出
```

### 只运行失败的测试

```bash
# 运行到第一个失败处停止
python manage.py test test_suite --failfast
```

## 📈 性能基准

典型运行时间（在标准开发机上）：

```
单元测试:           ~5 秒
集成测试:          ~15 秒
端到端测试:        ~10 秒
性能测试:          ~20 秒（包含批量操作）
错误处理测试:      ~3 秒
并发测试:          ~5 秒
————————————
全部测试:         ~60 秒

覆盖率报告:        ~2 秒
HTML报告生成:      ~1 秒
```

## 🆘 常见问题

### Q: 测试数据库连接失败？

**A**: 确保 Docker 服务正在运行
```bash
docker compose up -d
docker compose ps
```

### Q: 模块找不到？

**A**: 确保在正确的目录运行
```bash
cd backend  # 必须在backend目录
python manage.py test test_suite
```

### Q: 权限不足？

**A**: 检查文件权限
```bash
chmod +x run-comprehensive-tests.sh
chmod +x backend/run_comprehensive_tests.py
```

### Q: 某些测试超时？

**A**: 增加超时时间或跳过性能测试
```bash
# 使用 --quick 跳过性能测试
python run_comprehensive_tests.py --quick
```

## 📚 更多信息

详细信息请查阅：
- [完整测试指南](./COMPREHENSIVE_TESTING.md)
- [原始测试文档](./TESTING.md)

---

**最后更新**: 2025-12-22
