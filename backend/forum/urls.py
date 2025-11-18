from rest_framework.routers import DefaultRouter

from .views import (
    ForumCategoryViewSet,
    ForumCommentViewSet,
    ForumAttachmentViewSet,
    ForumPostViewSet,
    ForumTagViewSet,
)

router = DefaultRouter()
router.register(r"posts", ForumPostViewSet, basename="forum-post")
router.register(r"comments", ForumCommentViewSet, basename="forum-comment")
router.register(r"attachments", ForumAttachmentViewSet, basename="forum-attachment")
router.register(r"tags", ForumTagViewSet, basename="forum-tag")
router.register(r"categories", ForumCategoryViewSet, basename="forum-category")

urlpatterns = router.urls
