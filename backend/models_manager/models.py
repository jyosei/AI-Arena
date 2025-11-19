from django.db import models
from django.conf import settings
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
    created_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to='chat/', null=True, blank=True)
    
    class Meta:
        ordering = ['created_at']

    def __str__(self):
        # --- 相应地更新 __str__ 方法 ---
        return f"{self.get_role_display()}: {self.content[:50]}..."
