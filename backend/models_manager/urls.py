from django.urls import path
from .views import EvaluateModelView
from .views import BattleModelView,ModelListView
urlpatterns = [
    path('models/', ModelListView.as_view(), name='model-list'),
    path('models/evaluate/', EvaluateModelView.as_view(), name='evaluate-model'),
    path('battle/',BattleModelView.as_view(),name ='battle-model'),
]