from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    # 聚合各应用 API 前缀
    path('api/models/', include('models_manager.urls')),
    path('api/users/', include('users.urls')),  # 如果你有 users 应用，也这样包含
    path('api/forum/', include('forum.urls')),
    # 2. 将 JWT 认证路由也放在 'api/' 前缀下，并确保它们在 include 之前或之后，但不要混淆
    #    为了清晰，我们把它们放在这里。
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

# 媒体文件开发环境直接暴露（生产由 Nginx 处理）
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)