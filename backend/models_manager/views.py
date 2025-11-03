from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .services import get_model_service

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
