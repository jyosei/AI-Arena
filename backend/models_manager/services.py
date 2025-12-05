import os
from abc import ABC, abstractmethod
from openai import OpenAI
import base64
import math

class BaseEvaluationService(ABC):
    """数据集测评服务的抽象基类"""
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("An API key is required for evaluation services.")
        self.api_key = api_key
        self.client = None

    @abstractmethod
    def evaluate(self, prompt: str, model_name: str) -> str:
        pass

class OpenAIEvaluationService(BaseEvaluationService):
    """使用 OpenAI 兼容 API 进行测评的服务"""
    def __init__(self, api_key: str, base_url: str):
        super().__init__(api_key)
        self.client = OpenAI(api_key=self.api_key, base_url=base_url)

    def evaluate(self, prompt: str, model_name: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=1024,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"API_ERROR: {str(e)}"

def get_evaluation_model_service(model_name: str, api_key: str) -> BaseEvaluationService:
    """
    【测评专用】工厂函数：根据模型名称返回对应的测评服务实例。
    这是一个智能路由器，根据模型名称选择正确的 API 地址。
    """
    # API 地址映射表
    BASE_URL_MAP = {
        # 官方地址
        "gpt-": "https://jeniya.cn/v1",
        "glm-": "https://jeniya.cn/v1",
        "deepseek-": "https://api.deepseek.com",
        # ... 在这里添加其他模型的官方 base_url ...

        # --- 您的国内代理地址 ---
        # 我们可以为一些模型指定走您的代理
        "qwen-": "https://jeniya.cn/v1",
        "moonshot-": "https://jeniya.cn/v1",
    }

    # 查找模型前缀对应的 base_url
    model_prefix = next((prefix for prefix in BASE_URL_MAP if model_name.startswith(prefix)), None)
    
    if model_prefix:
        selected_base_url = BASE_URL_MAP[model_prefix]
        return OpenAIEvaluationService(api_key=api_key, base_url=selected_base_url)
    
    # 如果没有在映射表中找到特定的模型，可以提供一个默认选项。
    # 例如，默认所有未指定的模型都走您的代理。
    # 或者，您可以选择抛出一个错误，要求必须明确指定。
    # 这里我们选择默认走您的代理：
    print(f"Warning: Model '{model_name}' not found in BASE_URL_MAP. Defaulting to 'https://jeniya.cn/v1'.")
    return OpenAIEvaluationService(api_key=api_key, base_url="https://jeniya.cn/v1")


class BaseLanguageModel(ABC):
    """所有大模型服务的通用接口"""
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")

    @abstractmethod
    def evaluate(self, prompt: str, model_name: str, messages=None, image_base64=None, mime_type=None) -> str:
        pass

class OpenAIModel(BaseLanguageModel):
    def evaluate(self, prompt: str, model_name: str, messages=None, image_base64=None, mime_type=None) -> str:
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
                image_data = response.data[0]
                image_url = getattr(image_data, "url", None)
                if not image_url:
                    # 某些兼容服务返回 base64，而非可直接访问的 URL
                    b64_image = getattr(image_data, "b64_json", None) or getattr(image_data, "b64_image", None)
                    if b64_image:
                        mime = "image/png"
                        image_url = f"data:{mime};base64,{b64_image}"
                if not image_url:
                    raise ValueError("Image generation succeeded but no image payload was returned.")
                # --- 关键修改：直接返回可供前端渲染的 URL 或 data URL ---
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
            content = response.choices[0].message.content
            if isinstance(content, list):
                # 兼容新版返回结构
                combined = []
                for item in content:
                    if isinstance(item, dict) and 'text' in item:
                        combined.append(item['text'])
                    elif isinstance(item, str):
                        combined.append(item)
                content = "".join(combined)
            if content is None:
                raise ValueError("Model returned empty response content.")
            return content
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

def get_chat_model_service(model_name: str) -> BaseLanguageModel:
    """
    【聊天专用】工厂函数：根据模型名称返回一个模型服务实例。
    """
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


# ==============================================================================
# SECTION 3: ELO RATING SYSTEM (ELO 评分系统)
#
# 这部分逻辑独立，保持不变。
# ==============================================================================
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
