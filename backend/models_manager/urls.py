from django.urls import path
from .views import EvaluateModelView
from .views import BattleModelView,ModelListView, LeaderboardView

urlpatterns = [
    path('models/', ModelListView.as_view(), name='model-list'),
    path('models/evaluate/', EvaluateModelView.as_view(), name='evaluate-model'),
    path('battle/',BattleModelView.as_view(),name ='battle-model'),
    # 简陋的排行榜接口（返回示例 rank/value），供前端在后端未实现真实排行榜时使用
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
]