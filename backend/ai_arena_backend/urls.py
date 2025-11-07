from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # 1. 将所有应用相关的 API 路由都放在一个 'api/' 前缀下
    #    注意：'users.urls' 和 'models_manager.urls' 应该分开 include
    path('api/models/', include('models_manager.urls')),
    path('api/users/', include('users.urls')),  # 如果你有 users 应用，也这样包含
    # 2. 将 JWT 认证路由也放在 'api/' 前缀下，并确保它们在 include 之前或之后，但不要混淆
    #    为了清晰，我们把它们放在这里。
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]