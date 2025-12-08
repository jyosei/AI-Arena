
from django.db import migrations

# 定义我们要添加到数据库的初始模型数据
INITIAL_MODELS = [
    {
        "name": "gpt-4",
        "display_name": "GPT-4o",
        "owner": "OpenAI",
        "description": "OpenAI's most advanced model, with top-tier intelligence and vision capabilities.",
        "is_active": True,
    },
    {
        "name": "claude-3-opus-20240229",
        "display_name": "Claude 3 Opus",
        "owner": "Anthropic",
        "description": "Anthropic's most powerful model, delivering state-of-the-art performance on highly complex tasks.",
        "is_active": True,
    },
    {
        "name": "qwen-long",
        "display_name": "Qwen-Long",
        "owner": "Alibaba",
        "description": "Alibaba's long-context model, excelling at understanding and processing extensive texts.",
        "is_active": True,
    },
    {
        "name": "gpt-4",
        "display_name": "GPT-4",
        "owner": "OpenAI",
        "description": "A large multimodal model by OpenAI, predecessor to GPT-4o.",
        "is_active": True,
    },
    {
        "name": "gpt-5",
        "display_name": "GPT-5 (Placeholder)",
        "owner": "OpenAI",
        "description": "A placeholder for a future OpenAI model.",
        "is_active": False, # 注意：这个模型默认是不激活的，不会显示在排行榜上
    },
]

def create_initial_models(apps, schema_editor):
    """这个函数会在执行迁移时被调用，负责创建数据"""
    # 获取 AIModel 模型，这是在迁移中获取模型的标准方法
    AIModel = apps.get_model('models_manager', 'AIModel')
    
    for model_data in INITIAL_MODELS:
        # 使用 get_or_create 方法：如果模型已存在，则什么都不做；如果不存在，则创建它。
        # 这可以防止重复运行迁移时出错。
        AIModel.objects.get_or_create(name=model_data["name"], defaults=model_data)

def remove_initial_models(apps, schema_editor):
    """这个函数会在回滚迁移时被调用，负责删除数据"""
    AIModel = apps.get_model('models_manager', 'AIModel')
    model_names = [m["name"] for m in INITIAL_MODELS]
    AIModel.objects.filter(name__in=model_names).delete()


class Migration(migrations.Migration):

    # 这里的依赖项需要指向上一个迁移文件
    dependencies = [
        ('models_manager', '0003_benchmarkscore'), # 假设你的上一个迁移文件名是 0002_...
    ]

    operations = [
        # 告诉 Django 在执行此迁移时运行我们的函数
        migrations.RunPython(create_initial_models, remove_initial_models),
    ]