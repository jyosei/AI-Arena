from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ForumCommentLikeView, ForumCommentListCreateView, ForumPostViewSet

router = DefaultRouter()
router.register(r"posts", ForumPostViewSet, basename="forum-posts")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "posts/<int:post_id>/comments/",
        ForumCommentListCreateView.as_view(),
        name="forum-post-comments",
    ),
    path(
        "comments/<int:comment_id>/like/",
        ForumCommentLikeView.as_view(),
        name="forum-comment-like",
    ),
]
