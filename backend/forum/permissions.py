from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAuthorOrReadOnly(BasePermission):
    """只允许作者（或管理员）修改对象。"""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        author_id = getattr(obj, "author_id", None)
        if author_id is not None:
            return author_id == user.id or user.is_staff
        author = getattr(obj, "author", None)
        if author is None:
            return bool(user.is_staff)
        if hasattr(author, "id"):
            return author.id == user.id or user.is_staff
        return author == user or user.is_staff
