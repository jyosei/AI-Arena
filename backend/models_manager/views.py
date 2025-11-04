from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .services import get_model_service
import random
class EvaluateModelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        model_name = request.data.get("model_name")
        prompt = request.data.get("prompt")

        if not model_name or not prompt:
            return Response({"error": "model_name and prompt are required."}, status=400)

        try:
            model_service = get_model_service(model_name)
            
            # 重点：确保在这里传递了 prompt 和 model_name 两个参数
            response_text = model_service.evaluate(prompt, model_name) 
            
            return Response({
                "prompt": prompt,
                "model": model_name,
                "response": response_text
            })
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            # 将内部错误包装起来，提供更友好的提示
            # 注意：在生产环境中，不应暴露详细的内部错误 e
            return Response({"error": f"服务器内部错误: {e}"}, status=500)
class BattleModelView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self , request , *args , **kwargs):
        #1.请求模型的名称和prompt
        model_a_name = request.data.get("model_a")
        model_b_name = request.data.get("model_b")
        prompt = request.data.get("prompt")
        if not all([model_a_name, model_b_name, prompt]):
            return Response({"error": "model_a, model_b, and prompt are required."}, status=400)

        try:
            # 2. 获取两个模型对应的服务实例
            model_a_service = get_model_service(model_a_name)
            model_b_service = get_model_service(model_b_name)

            # 3. 调用各自的 evaluate 方法
            # 注意：这里是串行调用，后续可以优化为并行调用以提高速度
            response_a_data = model_a_service.evaluate(prompt, model_a_name)
            response_b_data = model_b_service.evaluate(prompt, model_b_name)

            # 4. 随机打乱顺序，实现“盲测”
            battle_results = [
                {"model": model_a_name, "response": response_a_data},
                {"model": model_b_name, "response": response_b_data},
            ]
            random.shuffle(battle_results)

            # 5. 返回包含两个模型结果的响应
            return Response({
                "prompt": prompt,
                "results": battle_results
            })
            
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            return Response({"error": f"服务器内部错误: {e}"}, status=500)