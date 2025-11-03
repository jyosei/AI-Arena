from django.urls import path
from .views import ModelEvaluationView

urlpatterns = [
    path('evaluate/', ModelEvaluationView.as_view(), name='model-evaluation'),
]