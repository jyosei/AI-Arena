from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny # 导入 AllowAny
from rest_framework.parsers import FormParser
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from .services import get_chat_model_service, get_evaluation_model_service, ELORatingSystem
from .models import BattleVote, AIModel,BenchmarkScore
from .models import ChatConversation
from .models import ChatMessage
from .serializers import ChatConversationSerializer, ChatMessageSerializer, AIModelSerializer,BenchmarkScoreSerializer
import random
import time
import base64
import os
from django.conf import settings
import csv 
import subprocess
import tempfile
import re
import json
from sympy import sympify, simplify
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
DATASET_METADATA = {
    # --- 数学与逻辑推理 ---
    "gsm8k.csv": {
        "id": "openai/gsm8k",
        "creator": "OpenAI",
        "name": "GSM8K",
        "modality": "text",
        "task": "Math Reasoning",
        "downloads": "492k",
        "likes": 985,
    },
    "math_competition.csv": {
        "id": "hendrycks/competition_math",
        "creator": "Hendrycks et al.",
        "name": "MATH",
        "modality": "text",
        "task": "Competition Math",
        "downloads": "115k",
        "likes": 230,
    },
    "commonsense_qa.csv": {
        "id": "tau/commonsense_qa",
        "creator": "Tel Aviv University",
        "name": "CommonsenseQA",
        "modality": "text",
        "task": "Commonsense Reasoning",
        "downloads": "120k",
        "likes": 115,
    },
    "squad_formatted.csv": { 
        "id": "stanford/squad",
        "creator": "Stanford",
        "name": "SQuAD",
        "modality": "text",
        "task": "Reading Comprehension",
        "downloads": "1M+",
        "likes": "10k+",
    },

    # --- 文本分类 ---
    "rotten_tomatoes.csv": {
        "id": "rotten_tomatoes",
        "creator": "Pang & Lee",
        "name": "Rotten Tomatoes",
        "modality": "text",
        "task": "Sentiment Analysis",
        "downloads": "500k+",
        "likes": 89,
    },
    "ag_news.csv": {
        "id": "fancyzhx/ag_news",
        "creator": "AG's Corpus",
        "name": "AG News",
        "modality": "text",
        "task": "Topic Classification",
        "downloads": "1.5M+",
        "likes": 150,
    },
    "glue-sst2.csv": {
        "id": "gimmaru/glue-sst2",
        "creator": "Stanford",
        "name": "SST-2 (GLUE)",
        "modality": "text",
        "task": "Sentiment Analysis",
        "downloads": "2M+",
        "likes": "1k+",
    },
    "emotion.csv": {
        "id": "dair-ai/emotion",
        "creator": "Saravia et al.",
        "name": "Emotion",
        "modality": "text",
        "task": "Emotion Classification",
        "downloads": "300k+",
        "likes": 210,
    },

    # --- 占位符/测试用 ---
    "test_math_small.csv": {
        "id": "local/test-math-small",
        "creator": "local",
        "name": "Small Math Test",
        "modality": "text",
        "task": "Math Reasoning",
        "downloads": "1",
        "likes": 0,
    },
    "test_sentiment_small.csv": {
        "id": "local/test-sentiment-small",
        "creator": "local",
        "name": "Small Sentiment Test",
        "modality": "text",
        "task": "Sentiment Analysis",
        "downloads": "1",
        "likes": 0,
    },
}


class RecordVoteView(APIView):
    """接收并记录一次对战的投票结果"""
    permission_classes = [AllowAny] # 允许任何人投票

    def post(self, request, *args, **kwargs):
        model_a = request.data.get('model_a')
        model_b = request.data.get('model_b') # 可能是 null
        prompt = request.data.get('prompt')
        winner = request.data.get('winner')

        # --- 修改验证逻辑 ---
        if not all([model_a, prompt, winner]):
            return Response({'error': 'Missing required fields: model_a, prompt, winner'}, status=status.HTTP_400_BAD_REQUEST)

        # 验证 winner 的值是否有效
        # 允许 model_b 为 None 的情况
        valid_winners = [model_a]
        if model_b:
            valid_winners.append(model_b)
        
        # 添加所有可能的投票选项
        valid_winners.extend(['tie', 'both_bad'])

        if winner not in valid_winners:
            return Response({'error': f'Invalid winner. Must be one of {valid_winners}'}, status=status.HTTP_400_BAD_REQUEST)

        # 创建并保存投票记录
        BattleVote.objects.create(
            model_a=model_a,
            model_b=model_b,  # 可以为 null
            prompt=prompt,
            winner=winner,
            voter=request.user if request.user.is_authenticated else None
        )

        # 如果是 battle 模式（model_b 存在），更新 ELO 评分
        if model_b and winner in [model_a, model_b, 'tie', 'both_bad']:
            try:
                ELORatingSystem.process_battle(model_a, model_b, winner)
            except Exception as e:
                # 记录错误但不影响投票记录的保存
                print(f"Error updating ELO ratings: {e}")

        return Response(status=status.HTTP_200_OK)
# 新增：模型列表视图
class ModelListView(APIView):
    # 允许任何人查看模型列表，所以暂时不需要登录
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # 建议：将 'task' 字段改为 'capabilities' 列表，以支持多功能表示
        # 'chat': 对话, 'vision': 识图, 'image_generation': 文生图, 'code': 代码
        dummy_models = [
            {"id": 1, "name": "gpt-3.5-turbo", "owner_name": "OpenAI", "capabilities": ["chat", "code"]},
            {"id": 2, "name": "gpt-5", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 3, "name": "gpt-5.1", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 4, "name": "gpt-5-codex", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 5, "name": "gpt-5-mini", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 6, "name": "gpt-5-search-api", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 7, "name": "dall-e-3", "owner_name": "OpenAI", "capabilities": ["image_generation"]},
            {"id": 8, "name": "gpt-4", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 9, "name": "gpt-4-turbo", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 10, "name": "gpt-4.1", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 11, "name": "gpt-4o-mini", "owner_name": "OpenAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 12, "name": "claude-haiku-4-5-20251001", "owner_name": "Anthropic", "capabilities": ["chat", "vision"]},
            {"id": 13, "name": "claude-opus-4-20245014-thinking", "owner_name": "Anthropic", "capabilities": ["chat", "vision"]},
            {"id": 14, "name": "claude-3-sonnet-20240229", "owner_name": "Anthropic", "capabilities": ["chat", "vision"]},
            {"id": 15, "name": "veo_3_1-fast", "owner_name": "google", "capabilities": ["chat"]},
            {"id": 16, "name": "gemini-2.0-flash", "owner_name": "Google", "capabilities": ["chat", "vision"]},
            {"id": 17, "name": "gemini-2.5-flash", "owner_name": "Google", "capabilities": ["chat", "vision"]},
            {"id": 18, "name": "gemini-2.5-flash-image", "owner_name": "Google", "capabilities": ["chat", "vision"]},
            {"id": 19, "name": "gemini-2.5-pro", "owner_name": "Google", "capabilities": ["chat", "vision", "code"]},
            {"id": 20, "name": "glm-4", "owner_name": "ZhipuAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 21, "name": "glm-4.5", "owner_name": "ZhipuAI", "capabilities": ["chat", "vision", "code"]},
            {"id": 22, "name": "deepseek-chat", "owner_name": "深度求索", "capabilities": ["chat", "code"]},
            {"id": 23, "name": "deepseek-ocr", "owner_name": "深度求索", "capabilities": ["vision"]},
            {"id": 24, "name": "deepseek-r1", "owner_name": "深度求索", "capabilities": ["chat", "code"]},
            {"id": 25, "name": "kimi-k2", "owner_name": "Moonshot", "capabilities": ["chat"]},
            {"id": 26, "name": "doubao-1-5-pro-32k-character-250228", "owner_name": "Doubao", "capabilities": ["chat"]},
            {"id": 27, "name": "llama-2-13b", "owner_name": "Ollama", "capabilities": ["chat", "code"]},
            {"id": 28, "name": "qwen-max", "owner_name": "阿里巴巴", "capabilities": ["chat", "vision", "code"]},
        ]
        return Response(dummy_models, status=status.HTTP_200_OK)


class EvaluateModelView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser,JSONParser, MultiPartParser] # 2. 添加解析器以支持文件上传

    def post(self, request, *args, **kwargs):
        model_name = request.data.get("model_name")
        prompt = request.data.get("prompt", "") # 允许 prompt 为空
        image_file = request.FILES.get("image") # 3. 获取可选的图片文件
        conversation_id = request.data.get("conversation_id")

        # 4. 更新验证逻辑：prompt 和 image 不能同时为空
        if not model_name or (not prompt and not image_file):
            return Response({"error": "model_name 和 (prompt 或 image) 是必需的。"}, status=400)

        try:
            model_service = get_model_service(model_name)
            
            # 获取或创建 conversation
            if conversation_id:
                # 使用现有的对话，并验证所有权
                try:
                    conversation = ChatConversation.objects.get(id=conversation_id)
                except ChatConversation.DoesNotExist:
                    return Response({"error": "Conversation not found."}, status=404)
            else:
                title = f"图片分析对话" if image_file else f"新对话 - {model_name}"
                conversation = ChatConversation.objects.create(
                    user = request.user,
                    title=title,
                    model_name=model_name
                )
            
            # --- 保存用户消息（包含可选的图片） ---
            ChatMessage.objects.create(
                conversation=conversation,
                role='user',
                content=prompt,
                image=image_file # 如果 image_file 为 None，Django 会正确处理
            )
            
            # --- 构建包含完整历史（包括历史图片）的消息体 ---
            history_messages = []
            for msg in conversation.messages.order_by('created_at'):
                if msg.role == 'user':
                    user_content = [{"type": "text", "text": msg.content}]
                    if msg.image:
                        msg.image.open('rb')
                        image_data = msg.image.read()
                        base64_image = base64.b64encode(image_data).decode('utf-8')
                        # 动态获取 mime_type
                        try:
                            import magic
                            mime_type = magic.from_buffer(image_data, mime=True)
                        except (ImportError, NameError):
                            mime_type = 'image/jpeg' # 回退方案
                        
                        image_url = f"data:{mime_type};base64,{base64_image}"
                        user_content.append({"type": "image_url", "image_url": {"url": image_url}})
                        msg.image.close()
                    history_messages.append({"role": "user", "content": user_content})
                else: # assistant
                    history_messages.append({"role": "assistant", "content": msg.content})

            # --- 关键修改：转换当前上传的图片 ---
            current_image_base64 = None
            current_mime_type = None
            if image_file:
                # 重置文件读取指针，以防之前被读取过
                image_file.seek(0) 
                image_data = image_file.read()
                current_image_base64 = base64.b64encode(image_data).decode('utf-8')
                current_mime_type = getattr(image_file, 'content_type', 'image/jpeg')

            # --- 使用正确的参数名调用模型服务 ---
            response_text = model_service.evaluate(
                prompt=prompt, 
                model_name=model_name,
                messages=history_messages,
                image_base64=current_image_base64, # <--- 使用 image_base64
                mime_type=current_mime_type        # <--- 使用 mime_type
            )
            
            # --- 保存 AI 响应 ---
            ChatMessage.objects.create(
                conversation=conversation,
                role='assistant',
                content=response_text
            )
            
            return Response({
                "response": response_text,
                "conversation_id": conversation.id
            }, status=200)
            
        except Exception as e:
            import logging
            logging.error(f"Error in EvaluateModelView: {e}", exc_info=True)
            return Response({"error": f"服务器内部错误: {e}"}, status=500)


class BattleModelView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        model_a_name = request.data.get("model_a")
        model_b_name = request.data.get("model_b")
        prompt = request.data.get("prompt")
        is_direct_chat = request.data.get("is_direct_chat", False)
        model_name = request.data.get("model_name")  # 用于 Direct Chat 模式

        if not prompt:
            return Response({"error": "prompt is required."}, status=400)

        # Direct Chat 模式
        if is_direct_chat:
            if not model_name and not model_a_name:
                return Response({"error": "model_name is required for direct chat mode."}, status=400)
            try:
                # 使用 model_name 或 model_a_name（为了兼容性）
                model_name = model_name or model_a_name
                model_service = get_model_service(model_name)
                response_data = model_service.evaluate(prompt, model_name)

                return Response({
                    "prompt": prompt,
                    "results": [
                        {"model": model_name, "response": response_data}
                    ],
                    "is_anonymous": False,
                    "is_direct_chat": True
                })
            except ValueError as e:
                return Response({"error": str(e)}, status=400)
            except Exception as e:
                return Response({"error": f"服务器内部错误: {e}"}, status=500)

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
                "is_anonymous": is_anonymous
            })
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            return Response({"error": f"服务器内部错误: {e}"}, status=500)


class LeaderboardView(APIView):
    """排行榜接口，返回基于 ELO 评分的模型排名"""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        metric = request.query_params.get('metric', 'score')
        task_type = request.query_params.get('task_type', None)
        
        # 查询活跃的模型，按 ELO 评分降序排列
        queryset = AIModel.objects.filter(is_active=True)
        
        # 可选：按任务类型过滤
        if task_type:
            queryset = queryset.filter(task_type=task_type)
        
        # 按 ELO 评分排序
        queryset = queryset.order_by('-elo_rating')
        
        # 序列化数据
        serializer = AIModelSerializer(queryset, many=True)
        
        # 添加排名信息
        ranked_data = []
        for idx, model_data in enumerate(serializer.data):
            model_data['rank'] = idx + 1
            # 根据 metric 选择展示的值
            if metric == 'score':
                model_data['value'] = round(model_data['elo_rating'], 0)
            elif metric == 'accuracy':
                model_data['value'] = round(model_data['win_rate'], 1)
            else:
                model_data['value'] = round(model_data['elo_rating'], 0)
            
            # 前端期望的字段名映射
            model_data['owner_name'] = model_data.get('owner', '-')
            model_data['name'] = model_data.get('display_name') or model_data.get('name')
            
            ranked_data.append(model_data)
        
        return Response(ranked_data, status=status.HTTP_200_OK)


class ChatHistoryView(APIView):
    """返回当前认证用户的会话历史（按时间倒序）。"""
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        convs = ChatConversation.objects.filter(user=request.user).order_by('-created_at')
        serializer = ChatConversationSerializer(convs, many=True)
        return Response(serializer.data)


class CreateConversationView(APIView):
    """允许认证用户创建新的会话（用于保存标题/会话条目）。"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        title = request.data.get('title') or '新会话'
        model_name = request.data.get('model_name')
        mode = request.data.get('mode', 'direct-chat')  # 获取模式，默认为 direct-chat
        conv = ChatConversation.objects.create(
            user=request.user, 
            title=title, 
            model_name=model_name,
            mode=mode  # 保存模式
        )
        serializer = ChatConversationSerializer(conv)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DeleteAllConversationsView(APIView):
    """删除当前用户的所有会话（谨慎调用）。"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        ChatConversation.objects.filter(user=request.user).delete()
        return Response({'message': 'deleted'}, status=status.HTTP_200_OK)


class DeleteConversationView(APIView):
    """删除或更新单个会话。"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, conversation_id, *args, **kwargs):
        try:
            conv = ChatConversation.objects.get(id=conversation_id, user=request.user)
            conv.delete()
            return Response({'message': 'deleted'}, status=status.HTTP_200_OK)
        except ChatConversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)
    
    def patch(self, request, conversation_id, *args, **kwargs):
        """更新会话的部分字段（如 model_name）"""
        try:
            conv = ChatConversation.objects.get(id=conversation_id, user=request.user)
            
            # 允许更新的字段
            if 'model_name' in request.data:
                conv.model_name = request.data['model_name']
            if 'title' in request.data:
                conv.title = request.data['title']
            
            conv.save()
            serializer = ChatConversationSerializer(conv)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ChatConversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)


class ConversationMessagesView(APIView):
    """获取指定会话的所有消息（按时间升序）。"""
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id, *args, **kwargs):
        try:
            conv = ChatConversation.objects.get(id=conversation_id, user=request.user)
        except ChatConversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)
        
        messages = conv.messages.all()
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)


class CreateMessageView(APIView):
    """为指定会话创建新消息（用户或AI消息）。"""
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        conversation_id = request.data.get('conversation_id')
        content = request.data.get('content')
        is_user = request.data.get('is_user', True)
        model_name = request.data.get('model_name', None)  # 可选的 model_name 字段

        if not conversation_id or not content:
            return Response({'error': 'conversation_id and content are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            conv = ChatConversation.objects.get(id=conversation_id, user=request.user)
        except ChatConversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

        message = ChatMessage.objects.create(
            conversation=conv, 
            content=content, 
            is_user=is_user,
            model_name=model_name  # 保存 model_name
        )
        serializer = ChatMessageSerializer(message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GenerateImageView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        prompt = request.data.get("prompt")
        if not prompt:
            return Response({"error": "Prompt is required."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. 在这里调用真实的图片生成 API (如 DALL-E, Stable Diffusion)
        #    task_id = some_image_api.submit_task(prompt=prompt)

        # 2. 为了演示，我们生成一个假的 task_id
        task_id = f"img_task_{int(time.time())}"

        # 3. 立即将 task_id 返回给前端
        return Response({"task_id": task_id}, status=status.HTTP_202_ACCEPTED)


class GetImageStatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        task_id = request.query_params.get("task_id")
        if not task_id:
            return Response({"error": "Task ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. 在这里调用图片生成 API 查询任务状态
        #    status_response = some_image_api.get_task_status(task_id)

        # 2. 为了演示，我们模拟一个过程 (假设 10 秒后完成)
        task_creation_time = int(task_id.split('_')[2])
        if time.time() - task_creation_time < 10:
             return Response({"status": "processing"}, status=status.HTTP_200_OK)
        else:
             # 任务完成，返回一个假的图片 URL (使用 placeholder 服务)
             dummy_image_url = f"https://picsum.photos/seed/{task_id}/512/512"
             return Response({
                 "status": "completed",
                 "image_url": dummy_image_url
             }, status=status.HTTP_200_OK)
        
class AnalyzeImageView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        prompt = request.data.get("prompt", "")
        image_file = request.FILES.get("image")
        model_name = request.data.get("model_name", "gpt-4o")
        conversation_id = request.data.get("conversation_id")

        if not image_file:
            return Response({"error": "必须提供图片文件。"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # --- 1. 获取模型服务 (现在是统一的方式) ---
            model_service = get_model_service(model_name)

            # --- 2. 获取或创建对话 ---
            if conversation_id:
                try:
                    conversation = ChatConversation.objects.get(id=conversation_id)
                except ChatConversation.DoesNotExist:
                    return Response({"error": "Conversation not found."}, status=status.HTTP_404)
            else:
                conversation = ChatConversation.objects.create(
                    title=f"图片分析对话",
                    model_name=model_name
                )

            # --- 3. 保存用户消息（包含图片） ---
            ChatMessage.objects.create(
                conversation=conversation,
                role='user',
                content=prompt,
                image=image_file
            )

            # --- 4. 构建历史消息 (纯文本部分) ---
            history_messages = [
                {"role": msg.role, "content": msg.content}
                for msg in conversation.messages.order_by('created_at')
            ]

            # --- 5. 调用统一的 evaluate 方法 ---
            #    将图片文件和历史记录一起传递给 service
            response_text = model_service.evaluate(
                prompt=prompt,
                model_name=model_name,
                messages=history_messages,
                image=image_file
            )

            # --- 6. 保存 AI 响应 ---
            ChatMessage.objects.create(
                conversation=conversation,
                role='assistant',
                content=response_text
            )

            return Response({
                "response": response_text,
                "conversation_id": conversation.id
            }, status=status.HTTP_200_OK)

        except ValueError as e: # 捕获 service 层的 API Key 错误
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({"error": f"服务器内部错误: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class DatasetListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        datasets_dir = settings.BASE_DIR / 'dataset_files'
        
        if not os.path.isdir(datasets_dir):
            return Response({"error": "数据集目录未找到"}, status=status.HTTP_404_NOT_FOUND)

        available_datasets = []
        try:
            for filename in os.listdir(datasets_dir):
                if filename.endswith('.csv'):
                    metadata = DATASET_METADATA.get(filename)
                    if metadata:
                        # 复制一份元数据，以免修改原始字典
                        data_to_send = metadata.copy()
                        # 关键：添加文件名，供前端使用
                        data_to_send['filename'] = filename 
                        available_datasets.append(data_to_send)
                    else:
                        # (可选) 为没有元数据的文件提供默认结构
                        available_datasets.append({
                            "id": f"local/{filename.replace('.csv', '')}",
                            "creator": "local",
                            "name": filename.replace('.csv', ''),
                            "modality": "unknown",
                            "downloads": "0",
                            "likes": 0,
                            "filename": filename, # <-- 同样在这里也加上
                        })
            
            return Response(available_datasets, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response({"error": f"无法读取数据集目录: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DatasetPreviewView(APIView):
    """为指定的数据集文件提供预览功能"""
    permission_classes = [AllowAny]

    def get(self, request, filename, *args, **kwargs):
        # 定义预览的行数
        PREVIEW_ROW_COUNT = 10

        # 安全性检查：确保文件名不包含路径遍历字符
        if ".." in filename or "/" in filename:
            return Response({"error": "无效的文件名"}, status=status.HTTP_400_BAD_REQUEST)

        dataset_path = settings.BASE_DIR / 'dataset_files' / filename
        
        if not os.path.exists(dataset_path):
            return Response({"error": f"数据集文件 '{filename}' 不存在"}, status=status.HTTP_404_NOT_FOUND)

        try:
            with open(dataset_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                
                # 读取表头
                headers = next(reader, None)
                if not headers:
                    return Response({"error": "数据集为空或格式错误"}, status=status.HTTP_400_BAD_REQUEST)

                # 读取前 N 行数据
                rows = []
                for i, row in enumerate(reader):
                    if i >= PREVIEW_ROW_COUNT:
                        break
                    # 将每一行数据与表头组合成字典
                    rows.append(dict(zip(headers, row)))
            
            # 返回结构化的 JSON 数据
            return Response({
                "filename": filename,
                "headers": headers,
                "rows": rows,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"读取文件时发生错误: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

import re
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
class EvaluateDatasetView(APIView):
    permission_classes = [IsAuthenticated]

    def _check_math_answer(self, model_answer, correct_answer):
        """
        更强大的答案校验函数，V7版，增强元组和 LaTeX 解析。
        """
        print("\n--- [DEBUG] New Answer Check ---")
        print(f"[DEBUG] Raw Model Answer: {repr(model_answer)}")
        print(f"[DEBUG] Raw Correct Answer: {repr(correct_answer)}")

        model_answer, correct_answer = str(model_answer), str(correct_answer)

        # 1. 增强的答案提取逻辑
        boxed_match = re.search(r'\\boxed\{(.*?)\}', model_answer, re.DOTALL) 
        if boxed_match:
            model_final_answer = boxed_match.group(1).strip()
            print(f"[DEBUG] Extracted from \\boxed: {repr(model_final_answer)}")
        else:
            # (保留原来的启发式提取逻辑)
            lines = model_answer.strip().split('\n')
            last_line = lines[-1].strip()
            if "####" in last_line:
                model_final_answer = last_line.split("####")[-1].strip()
            else:
                model_final_answer = last_line
            print(f"[DEBUG] Heuristically extracted: {repr(model_final_answer)}")

        # 2. 升级的 normalize_latex 函数
        def normalize_latex(text):
            text = re.sub(r'\\left|\\right', '', text)
            text = re.sub(r'\\text\{.*?\}', '', text)
            text = re.sub(r'\\boxed\{(.*?)\}', r'\1', text)
            text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'(\1)/(\2)', text)
            text = re.sub(r'\\sqrt\{([^}]+)\}', r'sqrt(\1)', text)
            text = re.sub(r'\\cdot|\\times', '*', text)
            text = text.replace(r'\pi', 'pi') # 将 \pi 替换为 sympy 可识别的 'pi'
            return text.strip()

        model_final_answer = normalize_latex(model_final_answer)
        correct_answer = normalize_latex(correct_answer)
        print(f"[DEBUG] Normalized Model Answer: {repr(model_final_answer)}")
        print(f"[DEBUG] Normalized Correct Answer: {repr(correct_answer)}")

        # 3. 核心升级：强大的元组/表达式比较函数
        def compare_expressions(expr1_str, expr2_str):
            try:
                # 检查是否为元组
                if expr1_str.startswith('(') and expr1_str.endswith(')') and \
                   expr2_str.startswith('(') and expr2_str.endswith(')'):
                    
                    # 分割元组元素，处理嵌套括号
                    elements1 = re.split(r',\s*(?![^()]*\))', expr1_str[1:-1])
                    elements2 = re.split(r',\s*(?![^()]*\))', expr2_str[1:-1])

                    if len(elements1) != len(elements2):
                        return False
                    
                    # 递归比较每个元素
                    for e1, e2 in zip(elements1, elements2):
                        if not compare_expressions(e1.strip(), e2.strip()):
                            return False
                    return True

                # 如果不是元组，作为单个表达式比较
                local_dict = {"pi": sympify("pi")}
                expr1 = sympify(expr1_str, locals=local_dict)
                expr2 = sympify(expr2_str, locals=local_dict)
                
                if simplify(expr1 - expr2) == 0:
                    return True
                return False
            except Exception as e:
                print(f"[DEBUG] Comparison Error: {e}")
                # 如果解析失败，回退到字符串比较
                return expr1_str.strip() == expr2_str.strip()

        # 4. 使用新的比较函数进行最终判断
        if compare_expressions(model_final_answer, correct_answer):
            print("[DEBUG] RESULT: TRUE (Advanced comparison match)")
            return True

        print("[DEBUG] RESULT: FALSE (All checks failed)")
        return False
    def _extract_final_answer(self, text: str) -> str:
        """从文本中提取 #### 后面的数字答案"""
        match = re.search(r'####\s*([\d,.-]+)', text)
        if match:
            return match.group(1).replace(',', '')
        
        # 如果没有 ####，尝试从最后一行提取数字
        lines = text.strip().split('\n')
        last_line = lines[-1]
        # 匹配可能包含数字的最后一行
        match = re.findall(r'[\d,.-]+', last_line)
        if match:
            return match[-1].replace(',', '')
        return ""

    def _evaluate_gsm8k(self, model_service, prompts,model_name:str):
        """处理 gsm8k 类型的数学推理任务"""
        correct = 0
        error_samples = []
        
        for row in prompts:
            question = row.get('question')
            true_answer_text = row.get('answer')
            if not question or not true_answer_text:
                continue

            true_final_answer = self._extract_final_answer(true_answer_text)
            
            # 使用思维链 Prompt
            prompt_to_model = f"Question: {question}\n\nLet's think step by step, and then write the final answer in the format '#### <number>'."
            
            try:
                model_response = model_service.evaluate(prompt=prompt_to_model, model_name=model_name)
                model_final_answer = self._extract_final_answer(model_response)

                if model_final_answer and true_final_answer and model_final_answer == true_final_answer:
                    correct += 1
                else:
                    if len(error_samples) < 5:
                        error_samples.append({
                            "prompt": question,
                            "expected_answer": true_final_answer,
                            "model_response": model_response
                        })
            except Exception as e:
                if len(error_samples) < 5:
                    error_samples.append({"prompt": question, "expected_answer": true_final_answer, "model_response": f"API Error: {e}"})

        accuracy = (correct / len(prompts) * 100) if prompts else 0
        return {
            "benchmark_type": "Math Reasoning (GSM8K)",
            "metrics": {"accuracy": round(accuracy, 2)},
            "total_prompts": len(prompts),
            "correct_answers": correct,
            "error_samples": error_samples,
        }
    def _evaluate_generic_math(self, model_service, prompts, model_name: str):
        """处理像 MATH 这样的通用数学任务，V2版，支持识图"""
        correct = 0
        error_samples = []
        
        for row in prompts:
            question = row.get('problem')
            true_answer = row.get('answer')
            if not question or not true_answer:
                continue

            prompt_to_model = question
            image_base64 = None
            mime_type = "image/png" # Asymptote 默认生成 PNG

            # 1. 检测并提取 [asy] 代码
            asy_match = re.search(r'\[asy\](.*?)\[/asy\]', question, re.DOTALL)
            if asy_match:
                asy_code = asy_match.group(1)
                # 从问题文本中移除 asy 代码块，使其更干净
                prompt_to_model = re.sub(r'\[asy\].*?\[/asy\]', '', question, flags=re.DOTALL).strip()

                # 2. 动态渲染图片
                try:
                    # 创建临时文件来保存 asy 代码和输出的 png 图片
                    with tempfile.NamedTemporaryFile(mode='w+', suffix='.asy', delete=True) as asy_file, \
                         tempfile.NamedTemporaryFile(suffix='.png', delete=True) as png_file:
                        
                        asy_file.write(asy_code)
                        asy_file.flush() # 确保所有内容都写入文件

                        # 构造并执行 asy 命令
                        # asy [asy_file_path] -f png -o [png_file_path]
                        command = ['asy', asy_file.name, '-f', 'png', '-o', png_file.name]
                        subprocess.run(command, check=True, timeout=15, capture_output=True)

                        # 3. 读取渲染好的图片并编码为 Base64
                        with open(png_file.name, 'rb') as f_img:
                            image_base64 = base64.b64encode(f_img.read()).decode('utf-8')
                        
                        print(f"[DEBUG] Successfully rendered image for prompt.")

                except FileNotFoundError:
                    print("[ERROR] 'asy' command not found. Please install Asymptote in your backend environment.")
                    # 选择降级处理：不带图片继续测评
                    image_base64 = None
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                    print(f"[ERROR] Asymptote rendering failed: {e.stderr.decode() if e.stderr else e}")
                    # 降级处理
                    image_base64 = None
            
            # 4. 调用模型服务 (现在可能包含图片)
            try:
                model_response = model_service.evaluate(
                    prompt=prompt_to_model, 
                    model_name=model_name,
                    image_base64=image_base64, # 传递图片
                    mime_type=mime_type if image_base64 else None
                )
                
                if self._check_math_answer(model_response, true_answer):
                    correct += 1
                else:
                    if len(error_samples) < 5:
                        error_samples.append({
                            "prompt": prompt_to_model,
                            "expected_answer": true_answer,
                            "model_response": model_response,
                            "image_base64": image_base64 # (可选) 将图片也存入错误样本，方便前端展示
                        })
            except Exception as e:
                if len(error_samples) < 5:
                    error_samples.append({"prompt": prompt_to_model, "expected_answer": true_answer, "model_response": f"API Error: {e}"})

        accuracy = (correct / len(prompts) * 100) if prompts else 0
        return {
            "benchmark_type": "General Math (with Vision)",
            "metrics": {"accuracy": round(accuracy, 2)},
            "total_prompts": len(prompts),
            "correct_answers": correct,
            "error_samples": error_samples,
        }
    
    def _evaluate_classification(self, model_service, prompts,model_name:str):
        """处理 rotten_tomatoes 类型的分类任务"""
        predictions = []
        ground_truth = []
        error_samples = []

        for row in prompts:
            text = row.get('text')
            label = row.get('label')
            if not text or label is None:
                continue

            ground_truth.append(int(label))
            
            # 引导模型做选择题
            prompt_to_model = f"Analyze the sentiment of the following movie review. Respond with only the word 'positive' or 'negative'.\n\nReview: '{text}'"
            
            try:
                model_response = model_service.evaluate(prompt=prompt_to_model, model_name=model_name).lower()
                
                predicted_label = 1 if 'positive' in model_response else 0
                predictions.append(predicted_label)

                if predicted_label != int(label) and len(error_samples) < 5:
                    error_samples.append({
                        "prompt": text,
                        "expected_answer": "positive" if int(label) == 1 else "negative",
                        "model_response": model_response
                    })
            except Exception as e:
                # 如果API出错，可以记为一个错误预测或跳过
                predictions.append(-1) # -1 表示错误
                if len(error_samples) < 5:
                    error_samples.append({"prompt": text, "expected_answer": "positive" if int(label) == 1 else "negative", "model_response": f"API Error: {e}"})

        # 过滤掉API出错的-1
        valid_indices = [i for i, p in enumerate(predictions) if p != -1]
        predictions = [predictions[i] for i in valid_indices]
        ground_truth = [ground_truth[i] for i in valid_indices]

        if not predictions:
            return {"metrics": {"accuracy": 0, "precision": 0, "recall": 0, "f1_score": 0}}

        accuracy = accuracy_score(ground_truth, predictions)
        precision = precision_score(ground_truth, predictions, average='binary', zero_division=0)
        recall = recall_score(ground_truth, predictions, average='binary', zero_division=0)
        f1 = f1_score(ground_truth, predictions, average='binary', zero_division=0)

        return {
            "benchmark_type": "Sentiment Classification",
            "metrics": {
                "accuracy": round(accuracy * 100, 2),
                "precision": round(precision * 100, 2),
                "recall": round(recall * 100, 2),
                "f1_score": round(f1 * 100, 2),
            },
            "total_prompts": len(prompts),
            "evaluated_prompts": len(predictions),
            "error_samples": error_samples,
        }

    def post(self, request, *args, **kwargs):
        dataset_name = request.data.get('dataset_name')
        model_name = request.data.get('model_name')
        user_api_key = request.data.get('api_key')

        if not dataset_name or not model_name:
            return Response({"error": "必须提供数据集和模型名称"}, status=status.HTTP_400_BAD_REQUEST)

        dataset_path = settings.BASE_DIR / 'dataset_files' / dataset_name
        if not os.path.exists(dataset_path):
            return Response({"error": f"数据集文件 '{dataset_name}' 不存在"}, status=status.HTTP_404_NOT_FOUND)

        try:
            model_service = get_evaluation_model_service(model_name, api_key=user_api_key)
            
            with open(dataset_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                prompts = list(reader)
                fieldnames = reader.fieldnames

            # --- 智能判断任务类型 ---
            if 'question' in fieldnames and 'answer' in fieldnames:
                result = self._evaluate_gsm8k(model_service, prompts, model_name=model_name)
            elif 'problem' in fieldnames and 'answer' in fieldnames: # <-- 新增的分支
                result = self._evaluate_generic_math(model_service, prompts, model_name=model_name)
            elif 'text' in fieldnames and 'label' in fieldnames:
                result = self._evaluate_classification(model_service, prompts, model_name=model_name)
            else:
                return Response({"error": "数据集格式不被支持。需要 (question, answer), (problem, answer) 或 (text, label) 列。"}, status=400)
            
            # 补充通用信息
            result['model_name'] = model_name
            result['dataset_name'] = dataset_name
            
            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"处理时发生严重错误: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class BenchmarkScoresView(APIView):
    """提供客观基准测评的排行榜数据"""
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # --- 从 JSON 文件加载伪造数据 ---
        # 设置 USE_FAKE_DATA 为 False 即可切换回真实数据
        USE_FAKE_DATA = True 

        if USE_FAKE_DATA:
            try:
                # 构建文件的绝对路径
                file_path = os.path.join(settings.BASE_DIR, 'models_manager', 'benchmark_scores.json')
                with open(file_path, 'r', encoding='utf-8') as f:
                    fake_data = json.load(f)
                return Response(fake_data)
            except (FileNotFoundError, json.JSONDecodeError) as e:
                return Response({"error": f"无法加载伪造的排行榜数据: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- 真实的数据库查询 ---
        scores = BenchmarkScore.objects.order_by('-total_score')
        serializer = BenchmarkScoreSerializer(scores, many=True)
        return Response(serializer.data)
