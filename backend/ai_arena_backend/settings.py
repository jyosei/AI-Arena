import os
from pathlib import Path
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# 加载 .env 文件

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY', 'default-secret-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', '1') == '1'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework', 
    'corsheaders',
    'users', 
    'datasets',
    'models_manager',
    'forum', 
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ai_arena_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ai_arena_backend.wsgi.application'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT'),
        'OPTIONS': {
            'charset': 'utf8mb4',
        }
    }
}

# NOTE: SQLite fallback removed — this project uses MySQL. Ensure the following
# environment variables are set: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT.

# 告诉 Django 使用你的自定义用户模型
AUTH_USER_MODEL = 'users.User'

# 新增：配置 Django Rest Framework
REST_FRAMEWORK = {
    # 设置默认的认证类
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # 你也可以在这里设置默认的权限类，例如要求所有视图默认都需要登录
    # 'DEFAULT_PERMISSION_CLASSES': [
    #     'rest_framework.permissions.IsAuthenticated',
    # ]
}

# 新增：配置 Simple JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60), # 访问令牌有效期
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),    # 刷新令牌有效期
}

# 前端根地址（用于 OAuth 回调重定向）
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# GitHub OAuth 配置（替换原微信登录）
GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID', 'your_github_client_id')
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET', 'your_github_client_secret')
GITHUB_REDIRECT_URI = os.getenv(
    'GITHUB_REDIRECT_URI', 
    f"{FRONTEND_URL}/login/github/callback"
)
GITHUB_SCOPES = os.getenv('GITHUB_SCOPES', 'read:user user:email')

# CORS 配置：允许通过环境变量控制
# 开发时可以设置 CORS_ALLOW_ALL_ORIGINS=1 以允许所有来源（仅开发）
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', '0') in ('1', 'true', 'True')
if not CORS_ALLOW_ALL_ORIGINS:
    # 从环境变量读取以逗号分隔的允许来源列表，例如: https://example.com,https://app.example.com
    cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', '')
    if cors_origins:
        CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_origins.split(',') if o.strip()]

# CSRF 配置：信任的来源
CSRF_TRUSTED_ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000']
# 允许从 nginx 代理通过
CSRF_COOKIE_SECURE = False  # 开发环境使用 HTTP
CSRF_COOKIE_HTTPONLY = False  # 允许 JavaScript 读取 CSRF cookie
CSRF_USE_SESSIONS = False  # 不使用 session 存储 CSRF token


STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

