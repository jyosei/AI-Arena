from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny # 导入 AllowAny
from rest_framework import status
from .services import get_model_service
from .models import BattleVote
import random
class RecordVoteView(APIView):
    """接收并记录一次对战的投票结果"""
    permission_classes = [AllowAny] # 允许任何人投票

    def post(self, request, *args, **kwargs):
        model_a = request.data.get('model_a')
        model_b = request.data.get('model_b')
        prompt = request.data.get('prompt')
        winner = request.data.get('winner')

        if not all([model_a, model_b, prompt, winner]):
            return Response({'error': 'Missing required fields (model_a, model_b, prompt, winner).'}, status=status.HTTP_400_BAD_REQUEST)

        # 验证 winner 的值是否有效
        valid_winners = [model_a, model_b, 'tie', 'both_bad']
        if winner not in valid_winners:
            return Response({'error': f'Invalid winner. Must be one of {valid_winners}'}, status=status.HTTP_400_BAD_REQUEST)

        # 创建并保存投票记录
        BattleVote.objects.create(
            model_a=model_a,
            model_b=model_b,
            prompt=prompt,
            winner=winner,
            voter=request.user if request.user.is_authenticated else None
        )

        return Response({'message': 'Vote recorded successfully.'}, status=status.HTTP_201_CREATED)
# 新增：模型列表视图
class ModelListView(APIView):
    # 允许任何人查看模型列表，所以暂时不需要登录
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # 以后这里会是从数据库查询的真实数据
        # models = Model.objects.all()
        # serializer = ModelSerializer(models, many=True)
        # return Response(serializer.data)

        # 现在，为了快速测试，我们返回一些硬编码的假数据
        dummy_models = [
            {"id": 1, "name": "gpt-3.5-turbo", "owner_name": "OpenAI", "task": "通用"},
            {"id": 2, "name": "glm-4", "owner_name": "智谱AI", "task": "通用"},
            {"id": 3, "name": "deepseek-chat", "owner_name": "深度求索", "task": "代码"},
            {"id": 4, "name": "qwen-max", "owner_name": "阿里巴巴", "task": "通用"},
        ]
        return Response(dummy_models, status=status.HTTP_200_OK)


class EvaluateModelView(APIView):
    permission_classes = [AllowAny]

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
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        model_a_name = request.data.get("model_a")
        model_b_name = request.data.get("model_b")
        prompt = request.data.get("prompt")

        if not prompt:
            return Response({"error": "prompt is required."}, status=400)

        # --- 逻辑分叉 ---
        # 场景1：匿名对战 (Anonymous Battle)
        # 如果前端没有提供 model_a 或 model_b，则进入匿名对战模式
        if not model_a_name or not model_b_name:
            # 1. 从可用模型列表中随机选择两个不重复的模型
            #    在真实应用中，这里应该从数据库中获取一个“可用于对战”的模型列表
            available_models = ["gpt-3.5-turbo", "glm-4", "deepseek-chat", "qwen-max"]
            if len(available_models) < 2:
                 return Response({"error": "Not enough models available for a battle."}, status=500)
            
            chosen_models = random.sample(available_models, 2)
            model_a_name, model_b_name = chosen_models[0], chosen_models[1]

        # 场景2：指定对战 (Side-by-Side)
        # 如果前端提供了 model_a 和 model_b，则代码会自然地执行到这里
        # 无需额外处理

        try:
            # 获取两个模型对应的服务实例
            model_a_service = get_model_service(model_a_name)
            model_b_service = get_model_service(model_b_name)

            # 调用各自的 evaluate 方法 (后续可优化为并行)
            response_a_data = model_a_service.evaluate(prompt, model_a_name)
            response_b_data = model_b_service.evaluate(prompt, model_b_name)

            # 准备返回结果
            battle_results = [
                {"model": model_a_name, "response": response_a_data},
                {"model": model_b_name, "response": response_b_data},
            ]
            # 关键：只有在匿名对战模式下才打乱顺序
            is_anonymous = not request.data.get("model_a") or not request.data.get("model_b")
            if is_anonymous:
                random.shuffle(battle_results)

            # 返回包含两个模型结果的响应
            return Response({
                "prompt": prompt,
                "results": battle_results,
                "is_anonymous": is_anonymous # 向前端明确指出这是否是一场匿名对战
            })
            
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            return Response({"error": f"服务器内部错误: {e}"}, status=500)


class LeaderboardView(APIView):
    """简陋的排行榜接口（用于前端在后端未完成真实 leaderboard 时的回退）。
    返回包含 id/name/owner_name/value/rank 的列表，按 value 降序。
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # 支持一个可选的 metric 查询参数（当前不影响返回，仅保留以便未来扩展）
        metric = request.query_params.get('metric', 'score')

        # 使用与 ModelListView 相同的假数据源，但带上示例的 value（分数）
        dummy_models = [
            {"id": 1, "name": "gpt-3.5-turbo", "owner_name": "OpenAI", "task": "通用"},
            {"id": 2, "name": "glm-4", "owner_name": "智谱AI", "task": "通用"},
            {"id": 3, "name": "deepseek-chat", "owner_name": "深度求索", "task": "代码"},
            {"id": 4, "name": "qwen-max", "owner_name": "阿里巴巴", "task": "通用"},
        ]

        # 简单固定分数；真实场景应由数据库或评估结果提供
        sample_scores = [95, 88, 76, 70]

        scored = []
        for i, m in enumerate(dummy_models):
            item = m.copy()
            item['value'] = sample_scores[i] if i < len(sample_scores) else 0
            scored.append(item)

        # 按 value 降序排序并添加 rank
        scored.sort(key=lambda x: x['value'], reverse=True)
        for idx, item in enumerate(scored):
            item['rank'] = idx + 1

        return Response(scored, status=status.HTTP_200_OK)