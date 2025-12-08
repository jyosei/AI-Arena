from django.db import models
from django.conf import settings


class DatasetEvaluationResult(models.Model):
    STATUS_CHOICES = (
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dataset_evaluations'
    )
    dataset_name = models.CharField(max_length=255)
    model_name = models.CharField(max_length=255)
    evaluation_mode = models.CharField(max_length=64, default='unknown')
    benchmark_type = models.CharField(max_length=128, blank=True)
    total_prompts = models.IntegerField(default=0)
    evaluated_prompts = models.IntegerField(default=0)
    correct_answers = models.IntegerField(default=0)
    metrics = models.JSONField(default=dict, blank=True)
    error_samples = models.JSONField(default=list, blank=True)
    elapsed_seconds = models.FloatField(default=0)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='running')
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['dataset_name']),
            models.Index(fields=['model_name']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.model_name} on {self.dataset_name} ({self.status})"


class DatasetEvaluationSample(models.Model):
    result = models.ForeignKey(
        DatasetEvaluationResult,
        on_delete=models.CASCADE,
        related_name='samples'
    )
    index = models.IntegerField()
    prompt = models.TextField(blank=True)
    expected_answer = models.TextField(blank=True)
    model_response = models.TextField(blank=True)
    is_correct = models.BooleanField(null=True)
    included_in_metrics = models.BooleanField(default=True)
    skipped = models.BooleanField(default=False)
    sample_time = models.FloatField(null=True, blank=True)
    message = models.CharField(max_length=255, blank=True)
    extra = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['index']
        indexes = [
            models.Index(fields=['result', 'index']),
            models.Index(fields=['result', 'is_correct']),
            models.Index(fields=['result', 'skipped']),
        ]

    def __str__(self):
        return f"Sample {self.index} of evaluation {self.result_id}"


class AIModel(models.Model):
    """存储AI模型信息和评分数据"""
    name = models.CharField(max_length=100, unique=True, help_text="模型名称")
    display_name = models.CharField(max_length=200, blank=True, help_text="展示名称")
    owner = models.CharField(max_length=100, blank=True, help_text="模型所有者/提供商")
    description = models.TextField(blank=True, help_text="模型描述")
    
    # ELO评分系统
    elo_rating = models.FloatField(default=1500.0, help_text="ELO评分，初始值1500")
    
    # 统计数据
    total_battles = models.IntegerField(default=0, help_text="总对战次数")
    wins = models.IntegerField(default=0, help_text="胜利次数")
    losses = models.IntegerField(default=0, help_text="失败次数")
    ties = models.IntegerField(default=0, help_text="平局次数")
    
    # 额外信息
    task_type = models.CharField(max_length=50, blank=True, help_text="任务类型（如：通用、代码、翻译等）")
    is_active = models.BooleanField(default=True, help_text="是否在排行榜中显示")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-elo_rating']
        indexes = [
            models.Index(fields=['-elo_rating']),
        ]
    
    def __str__(self):
        return f"{self.display_name or self.name} (ELO: {self.elo_rating:.0f})"
    
    @property
    def win_rate(self):
        """计算胜率"""
        if self.total_battles == 0:
            return 0.0
        return (self.wins / self.total_battles) * 100


# Create your models here.
class BattleVote(models.Model):
    """存储一次模型对战的投票结果"""
    model_a = models.CharField(max_length=100, help_text="模型A的名称")
    model_b = models.CharField(max_length=100, null=True, blank=True, help_text="模型B的名称")
    prompt = models.TextField(help_text="用户输入的提示")
    
    # 获胜方
    WINNER_CHOICES = [
        ('tie', 'Tie'),
        ('both_bad', 'Both are bad'),
        # 注意：这里的获胜方我们直接存储模型名称
    ]
    winner = models.CharField(max_length=100, help_text="获胜方的名称, 'tie', 或 'both_bad'")

    # 投票者 (可选，如果你的系统有用户登录)
    voter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Battle between {self.model_a} and {self.model_b} - Winner: {self.winner}"


class ChatConversation(models.Model):
    """存储用户的聊天会话（用于在前端展示历史会话）。"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null = True,
        blank = True
    )
    title = models.CharField(max_length=200)
    model_name = models.CharField(max_length=100, blank=True, null=True, help_text="对话使用的模型名称")
    mode = models.CharField(
        max_length=20, 
        default='direct-chat',
        choices=[
            ('direct-chat', 'Direct Chat'),
            ('side-by-side', 'Side by Side'),
            ('battle', 'Battle')
        ],
        help_text="对话模式"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.title} ({self.created_at})"


class ChatMessage(models.Model):
    """存储会话中的每条消息（用户或AI的回复）。"""
    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    # --- 关键修改：使用 role 字段代替 is_user ---
    ROLE_CHOICES = (
        ('user', 'User'),
        ('assistant', 'Assistant'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    content = models.TextField()
    is_user = models.BooleanField(default=True, help_text="True表示用户消息，False表示AI回复")
    model_name = models.CharField(max_length=100, blank=True, null=True, help_text="生成此消息的模型名称（仅AI消息）")
    created_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to='chat/', null=True, blank=True)
    
    class Meta:
        ordering = ['created_at']

    def __str__(self):
        # --- 相应地更新 __str__ 方法 ---
        return f"{self.get_role_display()}: {self.content[:50]}..."
        sender = "用户" if self.is_user else f"AI({self.model_name})"
        return f"{sender}: {self.content[:50]}..."
class BenchmarkScore(models.Model):
    model = models.OneToOneField(AIModel, on_delete=models.CASCADE, related_name='benchmark_score')
    total_score = models.FloatField(default=0.0, help_text="综合总分")
    # 使用 JSONField 存储各分类的得分，例如 {'代码能力': 95.0, '数学推理': 88.5}
    scores = models.JSONField(default=dict)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.model.name} - Score: {self.total_score}"
