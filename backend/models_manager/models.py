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
    """
    voter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    """
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Battle between {self.model_a} and {self.model_b} - Winner: {self.winner}"
