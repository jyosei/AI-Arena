from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ForumCategoryViewSet,
    ForumCommentViewSet,
    ForumAttachmentViewSet,
    ForumPostViewSet,
    ForumTagViewSet,
    ForumCommentLikeView,
    ForumCommentListCreateView,
    UserFavoritesView,
    UserHistoryView,
    UserLikedPostsView,
    UserCommentsView,
)

router = DefaultRouter()
router.register(r"posts", ForumPostViewSet, basename="forum-post")
router.register(r"comments", ForumCommentViewSet, basename="forum-comment")
router.register(r"attachments", ForumAttachmentViewSet, basename="forum-attachment")
router.register(r"tags", ForumTagViewSet, basename="forum-tag")
router.register(r"categories", ForumCategoryViewSet, basename="forum-category")

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
    # 用户中心相关列表
    path("me/favorites/", UserFavoritesView.as_view(), name="forum-user-favorites"),
    path("me/history/", UserHistoryView.as_view(), name="forum-user-history"),
    path("me/likes/", UserLikedPostsView.as_view(), name="forum-user-liked-posts"),
    path("me/comments/", UserCommentsView.as_view(), name="forum-user-comments"),
]
