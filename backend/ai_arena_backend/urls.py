from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # 您之后需要在这里为您自己的 app (如 users, datasets) 添加 URL
    # 例如: path('api/users/', include('users.urls')),
]