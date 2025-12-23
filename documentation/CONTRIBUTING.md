-````markdown
# 贡献指南

感谢你考虑为 AI-Arena 项目做出贡献！

## 如何贡献

### 报告 Bug

如果你发现了 Bug，请创建一个 Issue 并包含以下信息：

1. **清晰的标题** - 简洁描述问题
2. **详细描述** - 问题的详细说明
3. **复现步骤** - 如何复现这个问题
4. **期望行为** - 你期望发生什么
5. **实际行为** - 实际发生了什么
6. **环境信息** - 操作系统、浏览器版本、Docker 版本等
7. **截图或日志** - 如果适用

### 提出新功能

如果你有新功能的想法：

1. 先检查 Issues 中是否已有类似建议
2. 创建一个 Feature Request Issue
3. 详细描述功能的用途和价值
4. 如果可能，提供设计草图或示例

### 提交代码

#### 1. Fork 项目

点击项目页面右上角的 Fork 按钮

#### 2. 克隆你的 Fork

```bash
git clone https://github.com/your-username/AI-Arena.git
cd AI-Arena
```

#### 3. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

分支命名规范：
- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关

#### 4. 进行更改

- 遵循项目的代码风格
- 添加必要的测试
- 更新相关文档

#### 5. 提交更改

```bash
git add .
git commit -m "feat: add new feature"
```

提交信息规范（遵循 Conventional Commits）：
- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更新
- `style:` - 代码格式调整
- `refactor:` - 代码重构
- `test:` - 测试相关
- `chore:` - 构建或辅助工具的变动

#### 6. 推送到 GitHub

```bash
git push origin feature/your-feature-name
```

#### 7. 创建 Pull Request

1. 访问你的 Fork 页面
2. 点击 "New Pull Request"
3. 选择你的分支
4. 填写 PR 描述
5. 提交 Pull Request

### Pull Request 指南

一个好的 PR 应该：

1. **有清晰的标题** - 说明做了什么
2. **详细的描述** - 为什么做这个改动
3. **关联 Issue** - 如 "Closes #123"
4. **保持小而专注** - 一个 PR 只做一件事
5. **包含测试** - 验证你的改动
6. **更新文档** - 如果改动影响用户使用

...（原内容已迁移）

````
