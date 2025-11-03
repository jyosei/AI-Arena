from django.urls import path
from .views import RegisterView, ProfileView

urlpatterns = [
    # 这里只包含用户管理相关的 URL
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', ProfileView.as_view(), name='profile'),
]