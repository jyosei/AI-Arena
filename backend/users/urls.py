from django.urls import path
from .views import (
    RegisterView,
    ProfileView,
    ChangePasswordView,
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    FollowView,
    FollowListView,
    PrivateChatThreadsView,
    PrivateChatMessagesView,
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
    # 保留原有 follows/ 路由
    path('follows/<int:user_id>/', FollowView.as_view(), name='user-follow-old'),
    path('follows/', FollowListView.as_view(), name='follow-list'),

    # 兼容旧路由：使得 /api/users/<id>/follow/ 生效（test-e2e 期望的路径）
    path('<int:user_id>/follow/', FollowView.as_view(), name='compat-user-follow'),
    path('<int:user_id>/follow', FollowView.as_view()),

    path('private-chats/', PrivateChatThreadsView.as_view(), name='private-chat-threads'),
    path('private-chats/<int:user_id>/', PrivateChatMessagesView.as_view(), name='private-chat-messages'),

    # GitHub 登录
    path('github/login-url/', GitHubLoginURLView.as_view(), name='github-login-url'),
    path('github/callback/', GitHubCallbackView.as_view(), name='github-callback'),
    path('github/exchange/', GitHubCodeExchangeView.as_view(), name='github-code-exchange'),
]
