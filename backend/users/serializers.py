# filepath: /home/ubuntu/AI-Arena/backend/users/serializers.py
from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'password'] 
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

    def validate_username(self, value):
        """
        验证用户名。
        """
        if len(value) < 3:
            raise serializers.ValidationError("用户名长度至少为3个字符。")
        return value

    def validate_password(self, value):
        """
        验证密码。
        """
        if len(value) < 6:
            raise serializers.ValidationError("密码长度至少为6个字符。")
        return value

    def create(self, validated_data):
        """
        重写 create 方法以正确处理密码哈希。
        """
        try:
            user = User.objects.create_user(
                username=validated_data['username'],
                password=validated_data['password']
            )
            return user
        except Exception as e:
            raise serializers.ValidationError(str(e))