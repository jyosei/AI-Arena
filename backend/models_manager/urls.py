from django.urls import path
from .views import EvaluateModelView

urlpatterns = [
    path('evaluate/', EvaluateModelView.as_view(), name='model-evaluate'),
    path('battle/',BattleModelView.as_view(),name ='battle-model'),
]