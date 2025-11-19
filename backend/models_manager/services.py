import os
from abc import ABC, abstractmethod
from openai import OpenAI
import base64 # 导入 base64 库

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
            
            # 组装消息
            openai_messages = [
                {"role": "system", "content": "You are a helpful assistant."}
            ]
            if messages and isinstance(messages, list) and len(messages) > 0:
                openai_messages.extend(messages)
            else:
                openai_messages.append({"role": "user", "content": prompt})

            # --- 关键修改：处理图片输入 ---
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
            # 向上抛出异常，让视图层统一处理
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
