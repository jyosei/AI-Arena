from django.urls import path
from .views import EvaluateModelView
from .views import BattleModelView,ModelListView, LeaderboardView,RecordVoteView
from .views import ChatHistoryView, CreateConversationView, DeleteAllConversationsView, DeleteConversationView
from .views import ConversationMessagesView, CreateMessageView
from .views import GenerateImageView, GetImageStatusView,EvaluateDatasetView # 导入新的 View

urlpatterns = [
    path('', ModelListView.as_view(), name='model-list'),
    path('evaluate/', EvaluateModelView.as_view(), name='evaluate-model'),
    path('battle/',BattleModelView.as_view(),name ='battle-model'),
    path('chat/history/', ChatHistoryView.as_view(), name='chat-history'),
    path('chat/conversation/', CreateConversationView.as_view(), name='create-conversation'),
    path('chat/conversation/delete_all/', DeleteAllConversationsView.as_view(), name='delete-conversations'),
    path('chat/conversation/<int:conversation_id>/', DeleteConversationView.as_view(), name='delete-conversation'),
    path('chat/conversation/<int:conversation_id>/messages/', ConversationMessagesView.as_view(), name='conversation-messages'),
    path('chat/message/', CreateMessageView.as_view(), name='create-message'),
    # 简陋的排行榜接口（返回示例 rank/value），供前端在后端未实现真实排行榜时使用
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('record_vote/', RecordVoteView.as_view(), name='record-vote'),
    path('generate-image/', GenerateImageView.as_view(), name='generate-image'),
    path('get-image-status/', GetImageStatusView.as_view(), name='get-image-status'),
    path('evaluate-dataset/',EvaluateDatasetView.as_view(), name='evaluate-dataset'),
]