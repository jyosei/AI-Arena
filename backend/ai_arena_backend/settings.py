import os
from datetime import timedelta
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = 'dev-key'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.contenttypes', 'django.contrib.staticfiles',
    'rest_framework', 'corsheaders',
    'users', 'datasets'
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'ai_arena_backend.urls'
WSGI_APPLICATION = 'ai_arena_backend.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'aiarena',
        'USER': 'root',
        'PASSWORD': '123456',
        'HOST': 'db',
        'PORT': '3306',
    }
}

CORS_ALLOW_ALL_ORIGINS = True
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}
SIMPLE_JWT = {'ACCESS_TOKEN_LIFETIME': timedelta(hours=2)}
