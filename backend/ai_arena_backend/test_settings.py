"""
测试设置（强制使用 MySQL）

说明：请在运行测试前通过环境变量提供 MySQL 连接信息：
  - MYSQL_HOST
  - MYSQL_PORT (可选，默认 3306)
  - MYSQL_USER
  - MYSQL_PASSWORD
  - MYSQL_DATABASE

本设置不会回退到 SQLite；如果未提供完整的 MySQL 配置，将抛出错误并停止测试执行。
同时为保证测试稳定性，保留禁用迁移的机制（使用 syncdb 风格在测试时创建表）。
"""
from .settings import *  # noqa: F401,F403
import os
from django.core.exceptions import ImproperlyConfigured

# 必需的 MySQL 环境变量
MYSQL_HOST = os.environ.get('MYSQL_HOST')
MYSQL_USER = os.environ.get('MYSQL_USER')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD')
MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE')
MYSQL_PORT = os.environ.get('MYSQL_PORT', '3306')

missing = [k for k,v in (
    ('MYSQL_HOST', MYSQL_HOST),
    ('MYSQL_USER', MYSQL_USER),
    ('MYSQL_PASSWORD', MYSQL_PASSWORD),
    ('MYSQL_DATABASE', MYSQL_DATABASE),
)
if not v]

if missing:
    raise ImproperlyConfigured(
        '测试配置需要 MySQL 环境变量: ' + ', '.join(missing) +
        ". 请在运行测试前设置这些变量（示例： export MYSQL_HOST=127.0.0.1 MYSQL_USER=user MYSQL_PASSWORD=pass MYSQL_DATABASE=test_db）。"
    )

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': MYSQL_DATABASE,
        'USER': MYSQL_USER,
        'PASSWORD': MYSQL_PASSWORD,
        'HOST': MYSQL_HOST,
        'PORT': int(MYSQL_PORT) if MYSQL_PORT else 3306,
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
        },
    }
}

# 禁用迁移以避免跨分支/未同步迁移的解析问题；测试时使用 --run-syncdb 创建表
class _DisableMigrations(dict):
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None

MIGRATION_MODULES = _DisableMigrations()

# 测试环境下关闭 DEBUG
DEBUG = False
