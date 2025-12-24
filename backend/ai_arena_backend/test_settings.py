"""
轻量化的测试设置
该文件导入主设置并在测试时禁用数据库迁移，改用 SQLite 文件数据库，方便在 CI / 临时服务器上运行测试。
"""
from .settings import *  # noqa: F401,F403
import os

# 确保有 BASE_DIR（主设置通常定义）；否则定义一个备用的 BASE_DIR
try:
    BASE_DIR = BASE_DIR  # type: ignore
except NameError:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 使用轻量的 SQLite 测试数据库，避免外部 MySQL/Postgres 依赖
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'test_db.sqlite3'),
    }
}

# 禁用迁移以绕过可能的迁移顺序/解析问题（生产迁移请勿使用）
class _DisableMigrations(dict):
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None

MIGRATION_MODULES = _DisableMigrations()

# 在测试时关闭不必要的功能或外部服务的初始化。
# 如果主设置内有复杂的启动逻辑，这里可以覆盖相应的配置为安全模式。

# 确保调试/日志级别适合 CI
DEBUG = False
