from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification, PrivateChatThread, PrivateMessage, User, UserFollow
from .serializers import (
    UserSerializer,
    ChangePasswordSerializer,
    NotificationSerializer,
    PublicUserSerializer,
    FollowRelationSerializer,
    PrivateChatThreadSerializer,
    PrivateMessageSerializer,
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


class FollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        is_following = UserFollow.is_following(request.user, target)
        is_followed = UserFollow.is_following(target, request.user)
        mutual = is_following and is_followed
        follower_count = UserFollow.objects.filter(following=target).count()
        following_count = UserFollow.objects.filter(follower=target).count()
        return Response(
            {
                'following': is_following,
                'followed_by_target': is_followed,
                'mutual': mutual,
                'follower_count': follower_count,
                'following_count': following_count,
            }
        )

    def post(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        if target.pk == request.user.pk:
            return Response({'detail': '不能关注自己'}, status=status.HTTP_400_BAD_REQUEST)

        relation, created = UserFollow.objects.get_or_create(
            follower=request.user,
            following=target,
        )
        mutual = UserFollow.is_mutual(request.user, target)

        if created:
            Notification.create(recipient=target, actor=request.user, action_type='follow')
            if mutual:
                Notification.create(recipient=request.user, actor=target, action_type='mutual_follow')
                Notification.create(recipient=target, actor=request.user, action_type='mutual_follow')
                try:
                    PrivateChatThread.get_or_create_between(request.user, target)
                except ValueError:
                    pass

        # 如果是新建关注，返回 201 Created；否则返回 200 OK
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response({'following': True, 'mutual': mutual}, status=status_code)

    def delete(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        # 删除关注关系，按测试预期在成功删除时返回 204 No Content
        deleted, _ = UserFollow.objects.filter(follower=request.user, following=target).delete()
        if deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        # 如果没有关系存在，仍然返回 404 以和测试兼容
        return Response({'detail': '关注关系不存在'}, status=status.HTTP_404_NOT_FOUND)


class FollowListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        mode = request.query_params.get('type', 'following')
        if mode not in {'following', 'followers', 'mutual'}:
            return Response({'detail': 'type 参数仅支持 following、followers 或 mutual'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        following_relations = list(
            UserFollow.objects.filter(follower=user)
            .select_related('following')
            .order_by('-created_at')
        )
        follower_relations = list(
            UserFollow.objects.filter(following=user)
            .select_related('follower')
            .order_by('-created_at')
        )

        follower_id_set = {rel.follower_id for rel in follower_relations}
        following_id_set = {rel.following_id for rel in following_relations}

        payload: list[dict] = []

        if mode == 'following':
            for rel in following_relations:
                payload.append(
                    {
                        'user': rel.following,
                        'since': rel.created_at,
                        'is_mutual': rel.following_id in follower_id_set,
                        'direction': 'following',
                    }
                )
        elif mode == 'followers':
            for rel in follower_relations:
                payload.append(
                    {
                        'user': rel.follower,
                        'since': rel.created_at,
                        'is_mutual': rel.follower_id in following_id_set,
                        'direction': 'follower',
                    }
                )
        else:  # mutual
            mutual_ids = follower_id_set & following_id_set
            for rel in following_relations:
                if rel.following_id in mutual_ids:
                    payload.append(
                        {
                            'user': rel.following,
                            'since': rel.created_at,
                            'is_mutual': True,
                            'direction': 'following',
                        }
                    )

        serializer = FollowRelationSerializer(payload, many=True, context={'request': request})
        return Response({'type': mode, 'count': len(serializer.data), 'results': serializer.data})


class PrivateChatThreadsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        threads = (
            PrivateChatThread.objects.filter(Q(user_a=user) | Q(user_b=user))
            .select_related('user_a', 'user_b')
            .prefetch_related(
                Prefetch('messages', queryset=PrivateMessage.objects.order_by('-created_at'))
            )
            .order_by('-updated_at')
        )

        results = []
        for thread in threads:
            partner = thread.other_participant(user)
            if partner is None:
                continue
            messages = list(thread.messages.all())
            latest_message = messages[0] if messages else None
            unread_count = PrivateMessage.objects.filter(thread=thread, is_read=False).exclude(sender=user).count()
            results.append(
                {
                    'thread_id': thread.pk,
                    'partner': partner,
                    'unread_count': unread_count,
                    'latest_message': latest_message,
                    'updated_at': thread.updated_at,
                }
            )

        serializer = PrivateChatThreadSerializer(results, many=True, context={'request': request})
        return Response({'results': serializer.data})


class PrivateChatMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        if target.pk == request.user.pk:
            return Response({'detail': '无法查看与自己的私聊'}, status=status.HTTP_400_BAD_REQUEST)
        if not UserFollow.is_mutual(request.user, target):
            return Response({'detail': '仅限互相关注的用户之间私聊'}, status=status.HTTP_403_FORBIDDEN)

        thread, _ = PrivateChatThread.get_or_create_between(request.user, target)
        thread.messages.filter(sender=target, is_read=False).update(is_read=True)
        messages = thread.messages.select_related('sender').order_by('created_at')
        serializer = PrivateMessageSerializer(messages, many=True, context={'request': request})
        partner_data = PublicUserSerializer(target, context={'request': request}).data
        return Response({'thread_id': thread.pk, 'partner': partner_data, 'messages': serializer.data})

    def post(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        if target.pk == request.user.pk:
            return Response({'detail': '无法给自己发送私聊'}, status=status.HTTP_400_BAD_REQUEST)
        if not UserFollow.is_mutual(request.user, target):
            return Response({'detail': '仅限互相关注的用户之间私聊'}, status=status.HTTP_403_FORBIDDEN)

        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': '消息内容不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        thread, _ = PrivateChatThread.get_or_create_between(request.user, target)
        message = PrivateMessage.objects.create(thread=thread, sender=request.user, content=content)
        Notification.create(recipient=target, actor=request.user, action_type='private_message')
        serializer = PrivateMessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
