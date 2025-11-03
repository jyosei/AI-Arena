from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .services import get_model_service

class ModelEvaluationView(APIView):
    """
    接收前端请求，调用指定的大模型进行测评。
    """
    permission_classes = [IsAuthenticated] # 建议开启权限验证

    def post(self, request, *args, **kwargs):
        prompt = request.data.get('prompt')
        model_name = request.data.get('model_name')

        if not prompt or not model_name:
            return Response(
                {"error": "prompt 和 model_name 不能为空"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            model_service = get_model_service(model_name)
            model_response = model_service.evaluate(prompt)
            
            return Response(
                {"prompt": prompt, "model": model_name, "response": model_response},
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"服务器内部错误: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
