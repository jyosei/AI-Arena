from django.urls import path
from .views import (
    RegisterView,
    ProfileView,
    ChangePasswordView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
)
from .github_views import (
    GitHubLoginURLView,
    GitHubCallbackView,
    GitHubCodeExchangeView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-read'),
    path('notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name='notifications-mark-all-read'),

    # GitHub 登录
    path('github/login-url/', GitHubLoginURLView.as_view(), name='github-login-url'),
    path('github/callback/', GitHubCallbackView.as_view(), name='github-callback'),
    path('github/exchange/', GitHubCodeExchangeView.as_view(), name='github-code-exchange'),
]