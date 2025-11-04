import os
from abc import ABC, abstractmethod
from openai import OpenAI

# 1. 定义一个抽象基类作为统一接口
class BaseLanguageModel(ABC):
    """所有大模型服务的通用接口"""
    def __init__(self, api_key=None):
        # 如果没有显式传入 api_key，则从环境变量中获取
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")

    @abstractmethod
    def evaluate(self, prompt: str,model_name : str) -> str:
        """接收一个提示，返回模型的响应字符串"""
        pass

# 2. 为 OpenAI 创建一个具体的实现类
class OpenAIModel(BaseLanguageModel):
    def evaluate(self, prompt: str,model_name : str) -> str:
        try:
            client = OpenAI(
                # 使用从构造函数传入的 API Key
                api_key=self.api_key,
                # 这里是您指定的国内代理地址
                base_url="https://jeniya.cn/v1" 
            )
            response = client.chat.completions.create(
                # 注意：这里的模型名称可能需要根据代理服务的要求来写
                model=model_name, 
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    # 使用传入的 prompt 参数作为用户问题
                    {"role": "user", "content": prompt} 
                ],
                max_tokens=4096, # 建议设置一个合理的 max_tokens 值
                temperature=0.7
            )
            # 返回模型的响应内容，而不是打印它
            return response.choices[0].message.content
        except Exception as e:
            # 做好异常处理
            return f"调用 API 时出错: {e}"

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
