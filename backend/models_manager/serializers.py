from rest_framework import serializers
from .models import ChatConversation, ChatMessage

class ChatConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatConversation
        fields = ['id', 'title', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'conversation', 'content', 'is_user', 'created_at']
        read_only_fields = ['id', 'created_at']
