from django.contrib import admin
from .models import (
    BattleVote,
    ChatConversation,
    ChatMessage,
    AIModel,
    DatasetEvaluationResult,
    DatasetEvaluationSample,
)

@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'display_name', 'owner', 'elo_rating', 'total_battles', 'wins', 'losses', 'ties', 'win_rate', 'is_active')
    list_filter = ('is_active', 'task_type', 'owner')
    search_fields = ('name', 'display_name', 'owner', 'description')
    readonly_fields = ('created_at', 'updated_at', 'win_rate')
    ordering = ('-elo_rating',)
    
    fieldsets = (
        ('基本信息', {
            'fields': ('name', 'display_name', 'owner', 'description', 'task_type', 'is_active')
        }),
        ('评分数据', {
            'fields': ('elo_rating', 'total_battles', 'wins', 'losses', 'ties', 'win_rate')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

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


class DatasetEvaluationSampleInline(admin.TabularInline):
    model = DatasetEvaluationSample
    extra = 0
    readonly_fields = (
        'index',
        'prompt',
        'expected_answer',
        'model_response',
        'is_correct',
        'included_in_metrics',
        'skipped',
        'sample_time',
        'message',
        'extra',
    )
    can_delete = False


@admin.register(DatasetEvaluationResult)
class DatasetEvaluationResultAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'model_name',
        'dataset_name',
        'evaluation_mode',
        'status',
        'total_prompts',
        'evaluated_prompts',
        'correct_answers',
        'created_at',
    )
    list_filter = ('status', 'evaluation_mode', 'model_name', 'dataset_name', 'created_at')
    search_fields = ('model_name', 'dataset_name', 'extra')
    readonly_fields = (
        'user',
        'dataset_name',
        'model_name',
        'evaluation_mode',
        'benchmark_type',
        'total_prompts',
        'evaluated_prompts',
        'correct_answers',
        'metrics',
        'error_samples',
        'elapsed_seconds',
        'status',
        'extra',
        'created_at',
        'completed_at',
    )
    inlines = [DatasetEvaluationSampleInline]