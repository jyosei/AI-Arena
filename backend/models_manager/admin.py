from django.contrib import admin
from .models import BattleVote, ChatConversation, ChatMessage

@admin.register(BattleVote)
class BattleVoteAdmin(admin.ModelAdmin):
    list_display = ('model_a', 'model_b', 'winner', 'voter', 'created_at')
    list_filter = ('winner', 'model_a', 'model_b', 'created_at')
    search_fields = ('prompt',)

@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'model_name', 'created_at')
    list_filter = ('user', 'model_name', 'created_at')
    search_fields = ('title',)

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    # --- 关键修改：将 'is_user' 替换为 'role' ---
    list_display = ('conversation', 'role', 'content_preview', 'created_at')
    list_filter = ('role', 'created_at', 'conversation__model_name')
    search_fields = ('content',)

    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content Preview'