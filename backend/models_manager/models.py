from django.db import models
from django.conf import settings


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
    model_b = models.CharField(max_length=100, help_text="模型B的名称")
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
        sender = "用户" if self.is_user else f"AI({self.model_name})"
        return f"{sender}: {self.content[:50]}..."


class ModelTestResult(models.Model):
    """存储模型的测试结果数据"""
    model = models.ForeignKey(
        AIModel,
        on_delete=models.CASCADE,
        related_name='test_results',
        help_text="测试的模型"
    )
    
    # 测试类型
    TEST_TYPE_CHOICES = [
        ('accuracy', '准确度'),
        ('latency', '响应延迟'),
        ('throughput', '吞吐量'),
        ('perplexity', '困惑度'),
        ('custom', '自定义'),
    ]
    test_type = models.CharField(
        max_length=50,
        choices=TEST_TYPE_CHOICES,
        default='custom',
        help_text="测试类型"
    )
    
    # 测试内容
    test_name = models.CharField(max_length=255, help_text="测试名称")
    description = models.TextField(blank=True, help_text="测试描述")
    test_data = models.JSONField(default=dict, blank=True, help_text="测试数据集")
    
    # 测试结果
    score = models.FloatField(help_text="测试得分/结果")
    metrics = models.JSONField(default=dict, blank=True, help_text="详细指标")
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', '待测试'),
            ('running', '测试中'),
            ('passed', '通过'),
            ('failed', '失败'),
        ],
        default='pending',
        help_text="测试状态"
    )
    
    # 执行者和时间
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="测试执行者"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['model', '-created_at']),
            models.Index(fields=['test_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.model.name} - {self.test_name} ({self.get_status_display()})"


class LeaderboardSnapshot(models.Model):
    """存储排行榜快照（定期备份排名历史）"""
    snapshot_date = models.DateTimeField(auto_now_add=True, help_text="快照时间")
    
    # 排行榜数据
    leaderboard_data = models.JSONField(
        default=list,
        help_text="排行榜完整数据（JSON数组）"
    )
    
    # 统计信息
    total_models = models.IntegerField(help_text="参与排名的模型数量")
    total_battles = models.IntegerField(help_text="总对战次数")
    
    class Meta:
        ordering = ['-snapshot_date']
        verbose_name = "排行榜快照"
        verbose_name_plural = "排行榜快照"
    
    def __str__(self):
        return f"排行榜快照 - {self.snapshot_date.strftime('%Y-%m-%d %H:%M')}"
