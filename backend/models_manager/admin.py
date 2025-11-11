from django.contrib import admin
from .models import ChatConversation, BattleVote, ChatMessage


@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'created_at')
    list_filter = ('user',)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'is_user', 'content_preview', 'created_at')
    list_filter = ('is_user', 'conversation__user')
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'


@admin.register(BattleVote)
class BattleVoteAdmin(admin.ModelAdmin):
    list_display = ('model_a', 'model_b', 'winner', 'voter', 'created_at')
    list_filter = ('winner',)