from django.utils.text import Truncator
from rest_framework import serializers

from .models import Notification, PrivateChatThread, PrivateMessage, User, UserFollow


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, min_length=6, required=False)
    avatar_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    avatar_url = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'description', 'avatar', 'avatar_file', 'avatar_url'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'username': {
                'error_messages': {
                    'unique': '该用户名已被使用。',
                    'blank': '用户名不能为空。',
                    'required': '用户名是必填项。'
                }
            }
        }

    def get_avatar_url(self, obj: User) -> str:  # type: ignore[override]
        return obj.avatar_url

    def validate_username(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("用户名长度至少为3个字符。")
        return value

    def validate_password(self, value):
        if value and len(value) < 6:
            raise serializers.ValidationError("密码长度至少为6个字符。")
        return value
    def create(self, validated_data):
        password = validated_data.pop('password', None)
        avatar_file = validated_data.pop('avatar_file', None)
        if password:
            user = User.objects.create_user(password=password, **validated_data)
        else:
            # 支持无密码注册（例如社交登录），创建后设置为不可登录密码
            user = User.objects.create(**validated_data)
            user.set_unusable_password()
            user.save(update_fields=['password'])

        if avatar_file:
            user.avatar_file = avatar_file
            user.save(update_fields=['avatar_file'])
        return user

    def update(self, instance: User, validated_data):  # type: ignore[override]
        password = validated_data.pop('password', None)
        avatar_file = validated_data.pop('avatar_file', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if avatar_file:
            instance.avatar_file = avatar_file
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)

    def validate_current_password(self, value):
        user: User = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('当前密码不正确')
        return value

    def validate_new_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError('新密码长度至少6个字符')
        return value


class NotificationSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    actor_avatar_url = serializers.SerializerMethodField()
    message = serializers.CharField(read_only=True)
    post = serializers.IntegerField(source="post_id", read_only=True)
    comment = serializers.IntegerField(source="comment_id", read_only=True)
    post_title = serializers.CharField(source="post.title", read_only=True, default="")
    comment_excerpt = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "action_type",
            "is_read",
            "created_at",
            "actor_username",
            "actor_avatar_url",
            "post",
            "comment",
            "post_title",
            "comment_excerpt",
            "message",
        ]
        read_only_fields = fields

    def get_actor_avatar_url(self, obj: Notification) -> str:
        return getattr(obj.actor, 'avatar_url', '')

    def get_comment_excerpt(self, obj: Notification) -> str:
        comment = getattr(obj, "comment", None)
        if not comment:
            return ""
        content = getattr(comment, "content", "")
        if not content:
            return ""
        return Truncator(content).chars(60)


class PublicUserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "description",
            "avatar_url",
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj: User) -> str:  # type: ignore[override]
        return obj.avatar_url


class FollowRelationSerializer(serializers.Serializer):
    user = PublicUserSerializer()
    since = serializers.DateTimeField()
    is_mutual = serializers.BooleanField()
    direction = serializers.ChoiceField(choices=["following", "follower"], default="following")


class PrivateMessageSerializer(serializers.ModelSerializer):
    sender = PublicUserSerializer(read_only=True)

    class Meta:
        model = PrivateMessage
        fields = [
            "id",
            "thread",
            "sender",
            "content",
            "is_read",
            "created_at",
        ]
        read_only_fields = ["id", "thread", "sender", "is_read", "created_at"]


class PrivateChatThreadSerializer(serializers.Serializer):
    thread_id = serializers.IntegerField()
    partner = PublicUserSerializer()
    unread_count = serializers.IntegerField()
    latest_message = PrivateMessageSerializer(allow_null=True)
    updated_at = serializers.DateTimeField()