from rest_framework import serializers
from .models import ChatConversation, ChatMessage, AIModel


class AIModelSerializer(serializers.ModelSerializer):
    """AI模型序列化器，用于排行榜展示"""
    win_rate = serializers.ReadOnlyField()
    
    class Meta:
        model = AIModel
        fields = [
            'id', 'name', 'display_name', 'owner', 'description',
            'elo_rating', 'total_battles', 'wins', 'losses', 'ties',
            'win_rate', 'task_type', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChatConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatConversation
        fields = ['id', 'title', 'model_name', 'mode', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'conversation', 'content', 'is_user', 'model_name', 'created_at']
        read_only_fields = ['id', 'created_at']
