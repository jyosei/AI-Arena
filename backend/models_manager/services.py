import os
from abc import ABC, abstractmethod
from openai import OpenAI
import base64 # 导入 base64 库
import math


# ELO评分系统
class ELORatingSystem:
    """ELO评分系统，用于计算和更新模型评分"""
    
    @staticmethod
    def expected_score(rating_a, rating_b):
        """计算模型A相对于模型B的期望得分"""
        return 1 / (1 + math.pow(10, (rating_b - rating_a) / 400))
    
    @staticmethod
    def update_ratings(rating_a, rating_b, score_a, k_factor=32):
        """
        更新两个模型的ELO评分
        rating_a: 模型A的当前评分
        rating_b: 模型B的当前评分
        score_a: 模型A的实际得分 (1=胜, 0.5=平, 0=负)
        k_factor: K因子，决定评分变化幅度
        
        返回: (new_rating_a, new_rating_b)
        """
        expected_a = ELORatingSystem.expected_score(rating_a, rating_b)
        expected_b = 1 - expected_a
        
        score_b = 1 - score_a
        
        new_rating_a = rating_a + k_factor * (score_a - expected_a)
        new_rating_b = rating_b + k_factor * (score_b - expected_b)
        
        return new_rating_a, new_rating_b
    
    @staticmethod
    def process_battle(model_a_name, model_b_name, winner):
        """
        处理一次对战结果并更新两个模型的评分
        model_a_name: 模型A的名称
        model_b_name: 模型B的名称
        winner: 获胜者 (模型名称, 'tie', 或 'both_bad')
        
        返回: (model_a, model_b) 更新后的模型实例
        """
        from .models import AIModel
        
        # 获取或创建模型
        model_a, _ = AIModel.objects.get_or_create(
            name=model_a_name,
            defaults={'display_name': model_a_name}
        )
        model_b, _ = AIModel.objects.get_or_create(
            name=model_b_name,
            defaults={'display_name': model_b_name}
        )
        
        # 确定得分
        if winner == model_a_name:
            score_a = 1.0
        elif winner == model_b_name:
            score_a = 0.0
        elif winner in ['tie', 'both_bad']:
            score_a = 0.5
        else:
            # 默认按平局处理
            score_a = 0.5
        
        # 更新ELO评分
        new_rating_a, new_rating_b = ELORatingSystem.update_ratings(
            model_a.elo_rating,
            model_b.elo_rating,
            score_a
        )
        
        model_a.elo_rating = new_rating_a
        model_b.elo_rating = new_rating_b
        
        # 更新统计数据
        model_a.total_battles += 1
        model_b.total_battles += 1
        
        if score_a == 1.0:
            model_a.wins += 1
            model_b.losses += 1
        elif score_a == 0.0:
            model_a.losses += 1
            model_b.wins += 1
        else:
            model_a.ties += 1
            model_b.ties += 1
        
        model_a.save()
        model_b.save()
        
        return model_a, model_b


# 1. 定义一个抽象基类作为统一接口
class BaseLanguageModel(ABC):
    """所有大模型服务的通用接口"""
    def __init__(self, api_key=None):
        # 如果没有显式传入 api_key，则从环境变量中获取
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")

    @abstractmethod
    def evaluate(self, prompt: str, model_name: str, messages=None, image_base64=None,mime_type=None) -> str: # 修改 image 参数为 image_base64
        """生成模型回复。
        prompt: 当前用户输入（兼容旧接口）。
        messages: 可选的完整对话历史（[{role, content}]），若提供则以其为准。
        image: 可选的用户上传的图片文件对象。
        """
        pass

# 2. 为 OpenAI 创建一个具体的实现类
class OpenAIModel(BaseLanguageModel):
    def evaluate(self, prompt: str, model_name: str, messages=None, image_base64=None, mime_type=None) -> str: # 实现新的 image 参数
        try:
            client = OpenAI(
                api_key=self.api_key,
                base_url="https://jeniya.cn/v1" 
            )

            # --- DALL-E 模型处理逻辑 ---
            if model_name.startswith("dall"):
                # 从 messages 中获取最新的用户输入作为 prompt
                final_prompt = prompt
                if messages and isinstance(messages, list) and len(messages) > 0:
                    # 寻找最后一个用户角色的消息内容
                    last_user_message = next((msg['content'] for msg in reversed(messages) if msg['role'] == 'user'), None)
                    if last_user_message:
                        # DALL-E 只接受字符串 prompt
                        if isinstance(last_user_message, list):
                            # 如果是复杂的 content 列表（例如包含图片），提取文本部分
                            text_part = next((item['text'] for item in last_user_message if item['type'] == 'text'), None)
                            if text_part:
                                final_prompt = text_part
                        else:
                            final_prompt = last_user_message

                response = client.images.generate(
                    model=model_name,
                    prompt=final_prompt,
                    n=1,
                    size="1024x1024" # 或其他支持的尺寸
                )
                image_url = response.data[0].url
                # --- 关键修改：直接返回纯粹的 URL ---
                return image_url

            # --- 原有聊天模型逻辑 ---
            openai_messages = [
                {"role": "system", "content": "You are a helpful assistant."}
            ]
            if messages and isinstance(messages, list) and len(messages) > 0:
                openai_messages.extend(messages)
            else:
                openai_messages.append({"role": "user", "content": prompt})

            if image_base64 and mime_type:
                image_url = f"data:{mime_type};base64,{image_base64}"

                last_user_message = next((msg for msg in reversed(openai_messages) if msg['role'] == 'user'), None)
                if last_user_message:
                    if isinstance(last_user_message['content'], str):
                        last_user_message['content'] = [{"type": "text", "text": last_user_message['content']}]
                    
                    last_user_message['content'].append({
                        "type": "image_url",
                        "image_url": {"url": image_url}
                    })

            response = client.chat.completions.create(
                model=model_name,
                messages=openai_messages,
                max_tokens=4096,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            raise e

class ZhipuAIModel(OpenAIModel):
    """
    GLM与OpenAI兼容，直接继承就可以。
    """
    pass
class DeepSeekModel(OpenAIModel):
    """
    DeepSeek与OpenAI兼容，直接继承就可以。
    """
    pass
class GeminiModel(OpenAIModel):
    """
    Gemini与OpenAI兼容，直接继承就可以。
    """
    pass
class AnthropicModel(OpenAIModel):
    """
    claude与OpenAI兼容，直接继承就可以。
    """
    pass
class MoonshotModel(OpenAIModel):
    """
    moonshot与OpenAI兼容，直接继承就可以。
    """
    pass
class QWenModel(OpenAIModel):
    """
    qwen与OpenAI兼容，直接继承就可以。
    """
    pass
class HunyuanModel(OpenAIModel):
    """
    hunyuan与OpenAI兼容，直接继承就可以。
    """
    pass
class DoubaoModel(OpenAIModel):
    """
    doubao与OpenAI兼容，直接继承就可以。
    """
    pass
class LlamaModel(OpenAIModel):
    """
    llama与OpenAI兼容，直接继承就可以。
    """
    pass
class ERNIEBotModel(OpenAIModel):
    """
    ERNIE与OpenAI兼容，直接继承就可以。
    """
    pass
# 4. 创建一个工厂函数，根据名称获取对应的模型服务
def get_model_service(model_name: str) -> BaseLanguageModel:
    """根据模型名称返回一个模型服务实例"""
    if model_name.startswith("gpt"):
        return OpenAIModel()
    elif model_name.startswith("dall"):
        return OpenAIModel()
    elif model_name.startswith("glm"):
        return ZhipuAIModel()
    elif model_name.startswith("deepseek"):
        return DeepSeekModel()
    elif model_name.startswith("gemini"):
        return GeminiModel()
    elif model_name.startswith("claude"):
        return AnthropicModel()
    elif model_name.startswith("moonshot"):
        return MoonshotModel()
    elif model_name.startswith("qwen"):
        return QWenModel()
    elif model_name.startswith("ERNIE"):
        return ERNIEBotModel
    elif model_name.startswith("hunyuan"):
        return HunyuanModel()
    elif model_name.startswith("llama"):
        return LlamaModel()
    elif model_name.startswith("doubao"):
        return DoubaoModel()
    else:
        raise ValueError(f"Unsupported model: {model_name}")
