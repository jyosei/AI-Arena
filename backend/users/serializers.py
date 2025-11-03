# filepath: /home/ubuntu/AI-Arena/backend/users/serializers.py
from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # 定义需要序列化的字段，例如 username 和 password
        fields = ['id', 'username', 'password'] 
        # 将 password 字段设置为只写，这样它不会在响应中被返回
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        """
        重写 create 方法以正确处理密码哈希。
        """
        # 使用 User.objects.create_user 来创建用户
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user