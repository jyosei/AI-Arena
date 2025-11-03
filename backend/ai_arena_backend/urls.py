from django.contrib import admin
from django.urls import path, include

# 1. 从 simplejwt 导入视图
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # 2. 添加用于获取和刷新 token 的 URL
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # 您现有的应用 URL
    path('api/users/', include('users.urls')),
    path('api/models/', include('models_manager.urls')),
]