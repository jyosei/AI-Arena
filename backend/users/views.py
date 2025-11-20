from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User, Notification
from .serializers import (
    UserSerializer,
    ChangePasswordSerializer,
    NotificationSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # 禁用认证，允许匿名注册

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            detail = getattr(e, 'detail', str(e))
            return Response({'error': detail}, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer
    queryset = User.objects.all()

    def get_object(self):  # type: ignore[override]
        return self.request.user  # type: ignore[return-value]


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        validated = getattr(serializer, 'validated_data', {}) or {}
        new_password = validated.get('new_password')
        if not new_password:
            return Response({'detail': '新密码缺失'}, status=status.HTTP_400_BAD_REQUEST)
        user: User = request.user  # type: ignore[assignment]
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': '密码修改成功'}, status=status.HTTP_200_OK)


class NotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = Notification.objects.filter(recipient=self.request.user).select_related('actor')
        query_params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        unread = query_params.get('unread') if hasattr(query_params, 'get') else None
        if unread == 'true':
            qs = qs.filter(is_read=False)
        return qs.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        user = getattr(request, 'user', None)
        queryset = self.get_queryset()
        limited_queryset = queryset[:200]
        serializer = self.get_serializer(limited_queryset, many=True)
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        try:
            count = queryset.count()
        except Exception:
            count = 'unknown'
        print(
            f"[notifications] user={getattr(user, 'username', None)} total={count} unread={unread_count}",
            flush=True,
        )
        return Response({'results': serializer.data, 'unread_count': unread_count})


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': '通知不存在'}, status=status.HTTP_404_NOT_FOUND)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response({'detail': '已标记为已读'})


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'detail': '全部已标记为已读'})
