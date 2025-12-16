from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny # 导入 AllowAny
from rest_framework.parsers import FormParser
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
from .services import get_chat_model_service, get_evaluation_model_service, ELORatingSystem
from .models import (
    BattleVote,
    AIModel,
    ChatConversation,
    ChatMessage,
    DatasetEvaluationResult,
    DatasetEvaluationSample,
    BenchmarkScore,
)
from .serializers import ChatConversationSerializer, ChatMessageSerializer, AIModelSerializer,BenchmarkScoreSerializer
import random
import time
import base64
import os
import json
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
        "modality": "math", # <-- 修改
        "task": "Math Reasoning",
        "downloads": "492k",
        "likes": 985,
    },
    "math_competition.csv": {
        "id": "hendrycks/competition_math",
        "creator": "Hendrycks et al.",
        "name": "MATH",
        "modality": "math", # <-- 修改
        "task": "Competition Math",
        "downloads": "115k",
        "likes": 230,
    },
    "commonsense_qa.csv": {
        "id": "tau/commonsense_qa",
        "creator": "Tel Aviv University",
        "name": "CommonsenseQA",
        "modality": "reasoning", # <-- 修改
        "task": "Commonsense Reasoning",
        "downloads": "120k",
        "likes": 115,
    },
    "squad_formatted.csv": { 
        "id": "stanford/squad",
        "creator": "Stanford",
        "name": "SQuAD",
        "modality": "reading", # <-- 修改
        "task": "Reading Comprehension",
        "downloads": "1M+",
        "likes": "10k+",
    },

    # --- 文本分类 ---
    "rotten_tomatoes.csv": {
        "id": "rotten_tomatoes",
        "creator": "Pang & Lee",
        "name": "Rotten Tomatoes",
        "modality": "classification", # <-- 修改
        "task": "Sentiment Analysis",
        "downloads": "500k+",
        "likes": 89,
    },
    "ag_news.csv": {
        "id": "fancyzhx/ag_news",
        "creator": "AG's Corpus",
        "name": "AG News",
        "modality": "classification", # <-- 修改
        "task": "Topic Classification",
        "downloads": "1.5M+",
        "likes": 150,
    },
    "glue-sst2.csv": {
        "id": "gimmaru/glue-sst2",
        "creator": "Stanford",
        "name": "SST-2 (GLUE)",
        "modality": "classification", # <-- 修改
        "task": "Sentiment Analysis",
        "downloads": "2M+",
        "likes": "1k+",
    },
    "emotion.csv": {
        "id": "dair-ai/emotion",
        "creator": "Saravia et al.",
        "name": "Emotion",
        "modality": "classification", # <-- 修改
        "task": "Emotion Classification",
        "downloads": "300k+",
        "likes": 210,
    },

    # --- 占位符/测试用 ---
    "test_math_small.csv": {
        "id": "local/test-math-small",
        "creator": "local",
        "name": "Small Math Test",
        "modality": "math", # <-- 修改
        "task": "Math Reasoning",
        "downloads": "1",
        "likes": 0,
    },
    "test_sentiment_small.csv": {
        "id": "local/test-sentiment-small",
        "creator": "local",
        "name": "Small Sentiment Test",
        "modality": "classification", # <-- 修改
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
        model_b = request.data.get('model_b') # 可能是 null/空字符串
        prompt = request.data.get('prompt')
        winner = request.data.get('winner')

        # --- 修改验证逻辑 ---
        if not all([model_a, prompt, winner]):
            return Response({'error': 'Missing required fields: model_a, prompt, winner'}, status=status.HTTP_400_BAD_REQUEST)

        # 验证 winner 的值是否有效，并兼容前端的 'bad'/'good' 语义
        # 允许 model_b 为 None 的情况（direct-chat 模式）
        valid_winners = [model_a]
        if model_b:
            valid_winners.append(model_b)

        # 添加所有可能的投票选项
        valid_winners.extend(['tie', 'both_bad', 'bad', 'good'])

        if winner not in valid_winners:
            return Response({'error': f'Invalid winner. Must be one of {valid_winners}'}, status=status.HTTP_400_BAD_REQUEST)

        # 将前端语义映射到后端存储：
        # - 'bad' 统一存储为 'both_bad'
        # - direct-chat 模式下的 'good' 映射为 model_a
        if winner == 'bad':
            winner_to_store = 'both_bad'
        elif winner == 'good' and not model_b:
            winner_to_store = model_a
        else:
            winner_to_store = winner

        # 创建并保存投票记录
        # 确保 CharField 不接收 None，使用空字符串作为占位
        safe_model_b = model_b or ""
        BattleVote.objects.create(
            model_a=model_a,
            model_b=safe_model_b,  # CharField 使用空字符串代表缺失
            prompt=prompt,
            winner=winner_to_store,
            voter=request.user if request.user.is_authenticated else None
        )

        # 如果是 battle 模式（model_b 存在），更新 ELO 评分
        if safe_model_b and winner_to_store in [model_a, safe_model_b, 'tie', 'both_bad']:
            try:
                ELORatingSystem.process_battle(model_a, safe_model_b, winner_to_store)
            except Exception as e:
                # 记录错误但不影响投票记录的保存
                print(f"Error updating ELO ratings: {e}")

        # 如果是 direct-chat 模式（model_b 缺失），更新单模型的统计以反映到排行榜
        # 规则：
        # - winner_to_store == model_a 视为一次“好评”，wins +1，total_battles +1
        # - winner_to_store == 'tie'：改为“皆胜”策略，wins +1，total_battles +1
        # - winner_to_store == 'both_bad'：记为“皆负”，losses +1，total_battles +1
        # - 其他值忽略（不应出现），避免误更新
        if not safe_model_b:
            try:
                from .models import AIModel
                model, _ = AIModel.objects.get_or_create(name=model_a, defaults={"display_name": model_a})
                model.total_battles += 1
                if winner_to_store == model_a:
                    model.wins += 1
                elif winner_to_store == 'tie':
                    model.wins += 1
                elif winner_to_store == 'both_bad':
                    model.losses += 1
                else:
                    # 非预期值，不更新 wins/losses/ties
                    pass
                model.save()
            except Exception as e:
                print(f"Error updating single-model stats: {e}")

        return Response(status=status.HTTP_200_OK)
# 新增：模型列表视图
class ModelListView(APIView):
    # 允许任何人查看模型列表，所以暂时不需要登录
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # 建议：将 'task' 字段改为 'capabilities' 列表，以支持多功能表示
        # 'chat': 对话, 'vision': 识图, 'image_generation': 文生图, 'code': 代码
        dummy_models = [
           {"id": 2, "name": "gpt-5", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 3, "name": "gpt-5.1", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 4, "name": "gpt-5-codex", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 5, "name": "gpt-5-mini", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 7, "name": "dall-e-3", "owner_name": "OpenAI", "capabilities": ["image_generation"]},
            {"id": 8, "name": "gpt-4", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 9, "name": "gpt-4-turbo", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 10, "name": "gpt-4.1", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 11, "name": "gpt-4o-mini", "owner_name": "OpenAI", "capabilities": ["chat", "vision"]},
            {"id": 12, "name": "claude-haiku-4-5-20251001", "owner_name": "Anthropic", "capabilities": ["chat", "vision"]},
            {"id": 13, "name": "claude-opus-4-20245014-thinking", "owner_name": "Anthropic", "capabilities": ["chat", "vision"]},
            {"id": 14, "name": "claude-3-sonnet-20240229", "owner_name": "Anthropic", "capabilities": ["chat", "vision"]},
            {"id": 16, "name": "gemini-2.0-flash", "owner_name": "Google", "capabilities": ["chat", "vision"]},
            {"id": 17, "name": "gemini-2.5-flash", "owner_name": "Google", "capabilities": ["chat", "vision"]},
            {"id": 19, "name": "gemini-2.5-pro", "owner_name": "Google", "capabilities": ["chat", "vision"]},
            {"id": 20, "name": "glm-4", "owner_name": "ZhipuAI", "capabilities": ["chat", "vision"]},
            {"id": 21, "name": "glm-4.5", "owner_name": "ZhipuAI", "capabilities": ["chat", "vision"]},
            {"id": 22, "name": "deepseek-chat", "owner_name": "深度求索", "capabilities": ["chat"]},
            {"id": 23, "name": "deepseek-ocr", "owner_name": "深度求索", "capabilities": ["vision"]},
            {"id": 24, "name": "deepseek-r1", "owner_name": "深度求索", "capabilities": ["chat"]},
            {"id": 25, "name": "kimi-k2", "owner_name": "Moonshot", "capabilities": ["chat"]},
            {"id": 26, "name": "doubao-seed-1-6-250615", "owner_name": "Doubao", "capabilities": ["chat", "vision"]},
            {"id": 27, "name": "llama-2-13b", "owner_name": "Ollama", "capabilities": ["chat"]},
            {"id": 28, "name": "qwen-max", "owner_name": "阿里巴巴", "capabilities": ["chat", "vision"]},
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
        # 获取 save_user_message 参数，支持布尔值和字符串
        save_user_message_raw = request.data.get("save_user_message", True)
        if isinstance(save_user_message_raw, bool):
            save_user_message = save_user_message_raw
        elif isinstance(save_user_message_raw, str):
            save_user_message = save_user_message_raw.lower() in ['true', '1', 'yes']
        else:
            save_user_message = True  # 默认保存

        # 4. 更新验证逻辑：prompt 和 image 不能同时为空
        if not model_name or (not prompt and not image_file):
            return Response({"error": "model_name 和 (prompt 或 image) 是必需的。"}, status=400)

        try:
            model_service = get_chat_model_service(model_name)
            
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
            # 根据参数决定是否保存用户消息
            if save_user_message:
                ChatMessage.objects.create(
                    conversation=conversation,
                    role='user',
                    is_user=True,
                    content=prompt,
                    image=image_file
                )
            
            # --- 构建包含完整历史（包括历史图片）的消息体 ---
            history_messages = []
            history_queryset = list(conversation.messages.order_by('created_at'))
            if len(history_queryset) > 8:
                history_queryset = history_queryset[-8:]

            for msg in history_queryset:
                if msg.role == 'user':
                    if msg.image:
                        # 避免在历史消息中重复携带体积巨大的 Base64 图片数据
                        history_messages.append({
                            "role": "user",
                            "content": [{
                                "type": "text",
                                "text": (msg.content or "") + "\n[用户之前发送了一张图片，已省略]"
                            }]
                        })
                    else:
                        history_messages.append({
                            "role": "user",
                            "content": msg.content
                        })
                else:  # assistant
                    content = msg.content or ""
                    if isinstance(content, str) and (len(content) > 4000 or content.startswith("data:")):
                        history_messages.append({
                            "role": "assistant",
                            "content": "[上一次的图片结果已生成，请在历史消息中查看。]"
                        })
                    else:
                        history_messages.append({"role": "assistant", "content": content})

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

            if isinstance(response_text, (dict, list)):
                response_text = json.dumps(response_text, ensure_ascii=False)
            elif response_text is None:
                response_text = ""
            else:
                response_text = str(response_text)

            if not response_text:
                response_text = "[模型未返回任何内容]"
            
            # --- 保存 AI 响应 ---
            ChatMessage.objects.create(
                conversation=conversation,
                role='assistant',
                is_user=False,
                content=response_text,
                model_name=model_name
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
        conversation_id = request.data.get("conversation_id")  # 获取会话ID
        mode = request.data.get("mode", "battle")  # 新增：获取模式，默认为 battle

        if not prompt:
            return Response({"error": "prompt is required."}, status=400)

        # 获取或创建会话
        conversation = None
        if conversation_id:
            try:
                conversation = ChatConversation.objects.get(id=conversation_id)
            except ChatConversation.DoesNotExist:
                return Response({"error": "Conversation not found."}, status=404)
        
        # 如果没有提供conversation_id且用户已登录，创建新会话
        if not conversation and request.user.is_authenticated:
            # 根据模式确定model_name用于会话
            if is_direct_chat:
                conv_model_name = model_name or model_a_name
                actual_mode = 'direct-chat'
            else:
                conv_model_name = f"{model_a_name} vs {model_b_name}" if model_a_name and model_b_name else None
                # 使用前端传来的 mode，可能是 'battle' 或 'side-by-side'
                actual_mode = mode if mode in ['battle', 'side-by-side'] else 'battle'
            
            conversation = ChatConversation.objects.create(
                user=request.user,
                title=prompt[:50],
                model_name=conv_model_name,
                mode=actual_mode
            )

        # Direct Chat 模式
        if is_direct_chat:
            if not model_name and not model_a_name:
                return Response({"error": "model_name is required for direct chat mode."}, status=400)
            try:
                # 使用 model_name 或 model_a_name（为了兼容性）
                model_name = model_name or model_a_name
                model_service = get_chat_model_service(model_name)
                response_data = model_service.evaluate(prompt, model_name)

                # 保存到数据库
                if conversation:
                    # 保存用户消息
                    ChatMessage.objects.create(
                        conversation=conversation,
                        role='user',
                        content=prompt,
                        is_user=True
                    )
                    # 保存AI响应
                    ChatMessage.objects.create(
                        conversation=conversation,
                        role='assistant',
                        content=response_data,
                        is_user=False,
                        model_name=model_name
                    )

                return Response({
                    "prompt": prompt,
                    "results": [
                        {"model": model_name, "response": response_data}
                    ],
                    "is_anonymous": False,
                    "is_direct_chat": True,
                    "conversation_id": conversation.id if conversation else None
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

            # 如果已创建会话但尚未设置具体模型名，则在匿名对战确定模型后进行回填
            if conversation and not conversation.model_name:
                try:
                    conversation.model_name = f"{model_a_name} vs {model_b_name}"
                    conversation.save(update_fields=["model_name"])
                except Exception as _:
                    pass

        # 场景2：指定对战 (Side-by-Side)
        # 如果前端提供了 model_a 和 model_b，则代码会自然地执行到这里
        # 无需额外处理

        try:
            # 获取两个模型对应的服务实例
            model_a_service = get_chat_model_service(model_a_name)
            model_b_service = get_chat_model_service(model_b_name)

            # 构建历史上下文（如果有会话）：
            # - 用户消息对两侧共享
            # - 助手消息按模型名分别过滤，避免一侧模型收到另一侧的助手回答，导致上下文冲突
            history_messages_a = []
            history_messages_b = []
            if conversation:
                for msg in conversation.messages.order_by('created_at'):
                    if msg.role == 'user':
                        history_messages_a.append({"role": "user", "content": msg.content})
                        history_messages_b.append({"role": "user", "content": msg.content})
                    else:
                        # 仅保留各自模型的助手消息
                        if msg.model_name == model_a_name:
                            history_messages_a.append({"role": "assistant", "content": msg.content})
                        if msg.model_name == model_b_name:
                            history_messages_b.append({"role": "assistant", "content": msg.content})

            # 关键：在传给模型前，将当前用户输入也作为最后一条 user 消息加入上下文
            # 部分模型需要完整的 messages 序列（包含当前 user）而不是通过单独 prompt 参数
            if prompt:
                history_messages_a.append({"role": "user", "content": prompt})
                history_messages_b.append({"role": "user", "content": prompt})

            # 调用各自的 evaluate 方法，带上历史上下文
            response_a_data = model_a_service.evaluate(
                prompt=prompt,
                model_name=model_a_name,
                messages=history_messages_a
            )
            response_b_data = model_b_service.evaluate(
                prompt=prompt,
                model_name=model_b_name,
                messages=history_messages_b
            )

            # 保存到数据库
            if conversation:
                # 保存用户消息（先保存，保证下次有完整历史）
                ChatMessage.objects.create(
                    conversation=conversation,
                    role='user',
                    content=prompt,
                    is_user=True
                )
                # 保存模型A的响应
                ChatMessage.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=response_a_data,
                    is_user=False,
                    model_name=model_a_name
                )
                # 保存模型B的响应
                ChatMessage.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=response_b_data,
                    is_user=False,
                    model_name=model_b_name
                )

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
                "is_anonymous": is_anonymous,
                "conversation_id": conversation.id if conversation else None
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
        serializer = ChatMessageSerializer(messages, many=True,context={'request': request})
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
            model_service = get_chat_model_service(model_name)

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

    def _json_line(self, payload: dict) -> bytes:
        return (json.dumps(payload, ensure_ascii=True) + "\n").encode('utf-8')

    def _check_math_answer(self, model_answer, correct_answer):
        """
        更强大的答案校验函数，V8版，增强提取、归一化和元组比较。
        """
        print("\n--- [DEBUG] New Answer Check ---")
        print(f"[DEBUG] Raw Model Answer: {repr(model_answer)}")
        print(f"[DEBUG] Raw Correct Answer: {repr(correct_answer)}")

        model_answer, correct_answer = str(model_answer), str(correct_answer)

        # 1. 升级的 normalize_latex 函数
        def normalize_latex(text):
            # 去除 \left 和 \right
            text = re.sub(r'\\left|\\right', '', text)
            # 去除 \text{...}
            text = re.sub(r'\\text\{.*?\}', '', text)
            # 将 \frac{a}{b} 转为 (a)/(b)
            text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'(\1)/(\2)', text)
            # 将 \sqrt{...} 转为 sqrt(...)
            text = re.sub(r'\\sqrt\{([^}]+)\}', r'sqrt(\1)', text)
            # 统一乘号
            text = re.sub(r'\\cdot|\\times', '*', text)
            # 统一 pi
            text = text.replace(r'\pi', 'pi')
            # 去除单位，如 $
            text = text.replace('$', '')
            # 去除多余的 LaTeX 命令和空格
            text = text.strip()
            return text

        # 2. 增强的答案提取逻辑
        def extract_final_answer(text):
            # 优先匹配 \boxed{}
            boxed_match = re.search(r'\\boxed\{(.*?)\}', text, re.DOTALL)
            if boxed_match:
                return boxed_match.group(1).strip()
            
            # 其次匹配 ####
            hash_match = re.search(r'####\s*(.*)', text)
            if hash_match:
                return hash_match.group(1).strip()

            # 尝试从 "The answer is ..." 中提取
            ans_is_match = re.search(r'[Tt]he\s+(?:final\s+)?answer\s+is\s*\:?\s*(.*)', text)
            if ans_is_match:
                return ans_is_match.group(1).strip()

            # 降级策略：如果答案在开头，后面跟着解释
            # 匹配一个数字、分数或元组开头的行
            potential_answer_match = re.match(r'^(-?[\d\./\(\),]+|[a-zA-Z])\b.*', text.strip())
            if potential_answer_match:
                # 检查后面是否有常见的解释性词语
                if re.search(r'\b(Explanation|Solution|Proof|Since|Because)\b', text, re.IGNORECASE):
                    # 取第一个换行符之前的内容作为答案
                    return text.split('\n')[0].strip()

            # 最终降级：取最后一行非空行
            lines = [line.strip() for line in text.strip().split('\n') if line.strip()]
            return lines[-1] if lines else text

        model_final_answer = extract_final_answer(model_answer)
        print(f"[DEBUG] Extracted Model Answer: {repr(model_final_answer)}")

        # 3. 对提取出的答案和标准答案进行归一化
        norm_model_ans = normalize_latex(model_final_answer)
        norm_correct_ans = normalize_latex(correct_answer)
        print(f"[DEBUG] Normalized Model Answer: {repr(norm_model_ans)}")
        print(f"[DEBUG] Normalized Correct Answer: {repr(norm_correct_ans)}")

        # 4. 强大的元组/表达式比较函数
        def compare_expressions(expr1_str, expr2_str):
            try:
                # 检查是否为元组
                is_tuple1 = expr1_str.startswith('(') and expr1_str.endswith(')')
                is_tuple2 = expr2_str.startswith('(') and expr2_str.endswith(')')

                if is_tuple1 and is_tuple2:
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
                expr1 = sympify(expr1_str, locals=local_dict, convert_xor=True)
                expr2 = sympify(expr2_str, locals=local_dict, convert_xor=True)
                
                # 使用 simplify 比较差值是否为0
                if simplify(expr1 - expr2) == 0:
                    return True
                return False
            except Exception as e:
                print(f"[DEBUG] Comparison Error: {e}")
                # 如果解析失败，回退到字符串的精确比较
                return expr1_str.strip() == expr2_str.strip()

        # 5. 使用新的比较函数进行最终判断
        if compare_expressions(norm_model_ans, norm_correct_ans):
            print("[DEBUG] RESULT: TRUE (Advanced comparison match)")
            return True
        
        # 6. 最后的保险：如果 sympy 失败，再尝试一次简单的字符串包含检查
        if norm_correct_ans in norm_model_ans:
             print("[DEBUG] RESULT: TRUE (Substring fallback match)")
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

    def _evaluate_gsm8k(self, model_service, prompts, model_name: str):
        """处理 gsm8k 类型的数学推理任务"""
        correct = 0
        evaluated = 0
        error_samples = []
        samples = []
        started_at = time.perf_counter()

        for idx, row in enumerate(prompts, start=1):
            question = row.get('question')
            true_answer_text = row.get('answer')
            if not question or not true_answer_text:
                samples.append({
                    "index": idx,
                    "prompt": question or "",
                    "expected_answer": "",
                    "model_response": "",
                    "is_correct": None,
                    "included_in_metrics": False,
                    "skipped": True,
                    "sample_time": None,
                    "message": "缺少 question 或 answer 字段",
                })
                continue

            true_final_answer = self._extract_final_answer(true_answer_text)

            prompt_to_model = (
                "Question: "
                + question
                + "\n\nLet's think step by step, and then write the final answer in the format '#### <number>'."
            )

            sample_started = time.perf_counter()
            model_response = ""
            sample_error = None
            try:
                model_response = model_service.evaluate(prompt=prompt_to_model, model_name=model_name)
            except Exception as exc:
                sample_error = f"API Error: {exc}"
                model_response = sample_error

            sample_time = round(time.perf_counter() - sample_started, 3)
            model_final_answer = self._extract_final_answer(model_response)
            is_correct = bool(
                model_final_answer and true_final_answer and model_final_answer == true_final_answer
            ) if sample_error is None else None
            included_in_metrics = sample_error is None

            if included_in_metrics:
                evaluated += 1

            if is_correct:
                correct += 1
            elif len(error_samples) < 5:
                error_samples.append({
                    "prompt": question,
                    "expected_answer": true_final_answer,
                    "model_response": model_response,
                })

            samples.append({
                "index": idx,
                "prompt": question,
                "expected_answer": true_final_answer,
                "model_response": model_response,
                "is_correct": is_correct,
                "included_in_metrics": included_in_metrics,
                "skipped": False,
                "sample_time": sample_time,
                "message": sample_error or "",
            })

        total_elapsed = round(time.perf_counter() - started_at, 3)
        accuracy = (correct / evaluated * 100) if evaluated else 0
        return {
            "benchmark_type": "Math Reasoning (GSM8K)",
            "metrics": {"accuracy": round(accuracy, 2)},
            "total_prompts": len(prompts),
            "evaluated_prompts": evaluated,
            "correct_answers": correct,
            "error_samples": error_samples,
            "elapsed_seconds": total_elapsed,
            "samples": samples,
        }
    def _evaluate_generic_math(self, model_service, prompts, model_name: str):
        """处理像 MATH 这样的通用数学任务 - 纯文本版本"""
        correct = 0
        error_samples = []
        
        for row in prompts:
            question = row.get('problem')
            true_answer = row.get('answer')
            if not question or not true_answer:
                continue

            # --- 关键修改：不再处理图片，直接使用原始问题 ---
            prompt_to_model = question
            
            try:
                # --- 关键修改：调用模型服务时不再传递任何图片参数 ---
                model_response = model_service.evaluate(
                    prompt=prompt_to_model, 
                    model_name=model_name
                )
                
                if self._check_math_answer(model_response, true_answer):
                    correct += 1
                else:
                    if len(error_samples) < 5:
                        error_samples.append({
                            "prompt": prompt_to_model,
                            "expected_answer": true_answer,
                            "model_response": model_response,
                        })
            except Exception as e:
                if len(error_samples) < 5:
                    error_samples.append({"prompt": prompt_to_model, "expected_answer": true_answer, "model_response": f"API Error: {e}"})

        accuracy = (correct / len(prompts) * 100) if prompts else 0
        return {
            "benchmark_type": "General Math", # 移除了 (with Vision)
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
        samples = []
        started_at = time.perf_counter()

        for idx, row in enumerate(prompts, start=1):
            text = row.get('text')
            label = row.get('label')
            if text is None or label is None:
                samples.append({
                    "index": idx,
                    "prompt": text or "",
                    "expected_answer": "",
                    "model_response": "",
                    "is_correct": None,
                    "included_in_metrics": False,
                    "skipped": True,
                    "sample_time": None,
                    "message": "缺少 text 或 label 字段",
                })
                continue

            try:
                label_int = int(label)
            except (ValueError, TypeError):
                samples.append({
                    "index": idx,
                    "prompt": text,
                    "expected_answer": str(label),
                    "model_response": "",
                    "is_correct": None,
                    "included_in_metrics": False,
                    "skipped": True,
                    "sample_time": None,
                    "message": "label 无法解析为整数",
                })
                continue

            prompt_to_model = (
                "Analyze the sentiment of the following movie review. Respond with only the word 'positive' or 'negative'.\n\nReview: '"
                + text
                + "'"
            )

            sample_started = time.perf_counter()
            predicted_label = None
            model_response = ""
            sample_error = None
            try:
                model_response = model_service.evaluate(prompt=prompt_to_model, model_name=model_name).lower()
                predicted_label = 1 if 'positive' in model_response else 0
            except Exception as exc:
                sample_error = f"API Error: {exc}"
                model_response = sample_error

            sample_time = round(time.perf_counter() - sample_started, 3)

            included_in_metrics = predicted_label is not None
            is_correct = None

            if included_in_metrics:
                ground_truth.append(label_int)
                predictions.append(predicted_label)
                is_correct = predicted_label == label_int
                if not is_correct and len(error_samples) < 5:
                    error_samples.append({
                        "prompt": text,
                        "expected_answer": "positive" if label_int == 1 else "negative",
                        "model_response": model_response,
                    })
            else:
                if len(error_samples) < 5:
                    error_samples.append({
                        "prompt": text,
                        "expected_answer": "positive" if label_int == 1 else "negative",
                        "model_response": model_response,
                    })

            samples.append({
                "index": idx,
                "prompt": text,
                "expected_answer": "positive" if label_int == 1 else "negative",
                "model_response": model_response,
                "is_correct": is_correct,
                "included_in_metrics": included_in_metrics,
                "skipped": False,
                "sample_time": sample_time,
                "message": sample_error or "",
            })

        total_elapsed = round(time.perf_counter() - started_at, 3)

        if ground_truth and predictions:
            accuracy = accuracy_score(ground_truth, predictions)
            precision = precision_score(ground_truth, predictions, average='binary', zero_division=0)
            recall = recall_score(ground_truth, predictions, average='binary', zero_division=0)
            f1 = f1_score(ground_truth, predictions, average='binary', zero_division=0)
        else:
            accuracy = precision = recall = f1 = 0

        evaluated_prompts = len(predictions)

        return {
            "benchmark_type": "Sentiment Classification",
            "metrics": {
                "accuracy": round(accuracy * 100, 2),
                "precision": round(precision * 100, 2),
                "recall": round(recall * 100, 2),
                "f1_score": round(f1 * 100, 2),
            },
            "total_prompts": len(prompts),
            "evaluated_prompts": evaluated_prompts,
            "correct_answers": int(sum(1 for p, g in zip(predictions, ground_truth) if p == g)),
            "error_samples": error_samples,
            "elapsed_seconds": total_elapsed,
            "samples": samples,
        }

    def _persist_evaluation(self, request, dataset_name, model_name, evaluation_mode, summary, samples):
        user = request.user if request.user.is_authenticated else None
        completed_at = timezone.now()
        base_extra = summary.get('extra')
        extra_payload = {'source': 'sync'}
        if isinstance(base_extra, dict):
            extra_payload.update(base_extra)

        with transaction.atomic():
            evaluation_record = DatasetEvaluationResult.objects.create(
                user=user,
                dataset_name=dataset_name,
                model_name=model_name,
                evaluation_mode=evaluation_mode,
                benchmark_type=summary.get('benchmark_type', ''),
                total_prompts=summary.get('total_prompts') or len(samples),
                evaluated_prompts=summary.get('evaluated_prompts', 0),
                correct_answers=summary.get('correct_answers', 0),
                metrics=summary.get('metrics', {}),
                error_samples=summary.get('error_samples', []),
                elapsed_seconds=summary.get('elapsed_seconds', 0),
                status='completed',
                extra=extra_payload,
                completed_at=completed_at,
            )

            sample_objects = []
            for sample in samples:
                sample_objects.append(
                    DatasetEvaluationSample(
                        result=evaluation_record,
                        index=sample.get('index') or len(sample_objects) + 1,
                        prompt=sample.get('prompt', ''),
                        expected_answer=sample.get('expected_answer', ''),
                        model_response=sample.get('model_response', ''),
                        is_correct=sample.get('is_correct'),
                        included_in_metrics=sample.get('included_in_metrics', True),
                        skipped=sample.get('skipped', False),
                        sample_time=sample.get('sample_time'),
                        message=sample.get('message', ''),
                        extra={k: v for k, v in sample.items() if k not in {
                            'index',
                            'prompt',
                            'expected_answer',
                            'model_response',
                            'is_correct',
                            'included_in_metrics',
                            'skipped',
                            'sample_time',
                            'message',
                        }},
                    )
                )

            if sample_objects:
                DatasetEvaluationSample.objects.bulk_create(sample_objects)

        return evaluation_record

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
            evaluation_mode = None
            # --- 智能判断任务类型 ---
            if 'question' in fieldnames and 'answer' in fieldnames:
                evaluation_mode = 'gsm8k'
                result = self._evaluate_gsm8k(model_service, prompts, model_name=model_name)
            elif 'problem' in fieldnames and 'answer' in fieldnames: # <-- 新增的分支
                evaluation_mode = 'generic_math'
                result = self._evaluate_generic_math(model_service, prompts, model_name=model_name)
            elif 'text' in fieldnames and 'label' in fieldnames:
                evaluation_mode = 'classification'
                result = self._evaluate_classification(model_service, prompts, model_name=model_name)
            else:
                return Response({"error": "数据集格式不被支持。需要 (question, answer), (problem, answer) 或 (text, label) 列。"}, status=400)
            
            # 补充通用信息
            result['model_name'] = model_name
            result['dataset_name'] = dataset_name
            samples = result.pop('samples', [])

            evaluation_record = self._persist_evaluation(
                request=request,
                dataset_name=dataset_name,
                model_name=model_name,
                evaluation_mode=evaluation_mode,
                summary=result,
                samples=samples,
            )
            result['evaluation_id'] = evaluation_record.id
            
            return Response(result, status=status.HTTP_200_OK)

        except ValueError as ve:
            # 典型场景：缺少 API Key
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": f"处理时发生严重错误: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class EvaluateDatasetStreamView(EvaluateDatasetView):
    permission_classes = [IsAuthenticated]

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
        except Exception as exc:
            return Response({"error": f"无法初始化模型服务: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        with open(dataset_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            prompts = list(reader)
            fieldnames = reader.fieldnames or []

        if not prompts:
            return Response({"error": "数据集中没有可用的样本"}, status=status.HTTP_400_BAD_REQUEST)

        if 'question' in fieldnames and 'answer' in fieldnames:
            evaluation_mode = 'gsm8k'
        elif 'problem' in fieldnames and 'answer' in fieldnames:
            evaluation_mode = 'generic_math'
        elif 'text' in fieldnames and 'label' in fieldnames:
            evaluation_mode = 'classification'
        else:
            return Response({"error": "数据集格式不被支持。需要 (question, answer)、(problem, answer) 或 (text, label) 列。"}, status=status.HTTP_400_BAD_REQUEST)

        total_prompts = len(prompts)
        benchmark_type = 'Math Reasoning (GSM8K)' if evaluation_mode == 'gsm8k' else 'Sentiment Classification'
        evaluation_record = DatasetEvaluationResult.objects.create(
            user=request.user if request.user.is_authenticated else None,
            dataset_name=dataset_name,
            model_name=model_name,
            evaluation_mode=evaluation_mode,
            benchmark_type=benchmark_type,
            total_prompts=total_prompts,
            status='running',
            extra={'source': 'stream'},
        )

        def stream():
            start_time = time.perf_counter()
            yield self._json_line({
                "type": "init",
                "dataset_name": dataset_name,
                "model_name": model_name,
                "total": total_prompts,
                "started_at": time.time(),
                "evaluation_id": evaluation_record.id,
            })

            try:
                if evaluation_mode == 'gsm8k':
                    yield from self._stream_gsm8k(
                        model_service,
                        prompts,
                        model_name,
                        dataset_name,
                        total_prompts,
                        start_time,
                        evaluation_record,
                    )
                elif evaluation_mode == 'classification':
                    yield from self._stream_classification(
                        model_service,
                        prompts,
                        model_name,
                        dataset_name,
                        total_prompts,
                        start_time,
                        evaluation_record,
                    )
                else:  # generic_math
                    yield from self._stream_generic_math(
                        model_service,
                        prompts,
                        model_name,
                        dataset_name,
                        total_prompts,
                        start_time,
                        evaluation_record,
                    )
            except Exception as exc:
                evaluation_record.status = 'failed'
                evaluation_record.extra = {
                    **(evaluation_record.extra or {}),
                    'error': str(exc),
                }
                evaluation_record.elapsed_seconds = round(time.perf_counter() - start_time, 3)
                evaluation_record.completed_at = timezone.now()
                evaluation_record.save(update_fields=['status', 'extra', 'elapsed_seconds', 'completed_at'])
                yield self._json_line({
                    "type": "error",
                    "message": f"处理时发生严重错误: {exc}"
                })

        response = StreamingHttpResponse(stream(), content_type='application/x-ndjson')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def _stream_gsm8k(self, model_service, prompts, model_name, dataset_name, total_prompts, start_time, evaluation_record):
        correct = 0
        evaluated = 0
        processed = 0
        error_samples = []
        batch = []

        def flush_batch():
            nonlocal batch
            if batch:
                DatasetEvaluationSample.objects.bulk_create(batch)
                batch = []

        for row in prompts:
            processed += 1
            question = row.get('question')
            true_answer_text = row.get('answer')
            if not question or not true_answer_text:
                batch.append(
                    DatasetEvaluationSample(
                        result=evaluation_record,
                        index=processed,
                        prompt=question or "",
                        expected_answer="",
                        model_response="",
                        is_correct=None,
                        included_in_metrics=False,
                        skipped=True,
                        sample_time=None,
                        message="缺少 question 或 answer 字段",
                    )
                )
                if len(batch) >= 50:
                    flush_batch()
                yield self._json_line({
                    "type": "progress",
                    "index": processed,
                    "total": total_prompts,
                    "skipped": True,
                    "message": "缺少 question 或 answer 字段",
                    "elapsed": round(time.perf_counter() - start_time, 3)
                })
                continue

            true_final_answer = self._extract_final_answer(true_answer_text)
            prompt_to_model = "Question: " + question + "\n\nLet's think step by step, and then write the final answer in the format '#### <number>'."

            sample_started = time.perf_counter()
            sample_error = None
            try:
                model_response = model_service.evaluate(prompt=prompt_to_model, model_name=model_name)
            except Exception as exc:
                sample_error = f"API Error: {exc}"
                model_response = sample_error

            model_final_answer = self._extract_final_answer(model_response)
            is_correct = bool(
                model_final_answer and true_final_answer and model_final_answer == true_final_answer
            ) if sample_error is None else None
            included_in_metrics = sample_error is None

            if included_in_metrics:
                evaluated += 1
                if is_correct:
                    correct += 1
                elif len(error_samples) < 5:
                    error_samples.append({
                        "prompt": question,
                        "expected_answer": true_final_answer,
                        "model_response": model_response
                    })
            elif len(error_samples) < 5 and sample_error:
                error_samples.append({
                    "prompt": question,
                    "expected_answer": true_final_answer,
                    "model_response": model_response
                })

            sample_time = round(time.perf_counter() - sample_started, 3)
            running_accuracy = round((correct / evaluated) * 100, 2) if evaluated else 0.0

            batch.append(
                DatasetEvaluationSample(
                    result=evaluation_record,
                    index=processed,
                    prompt=question,
                    expected_answer=true_final_answer,
                    model_response=model_response,
                    is_correct=is_correct,
                    included_in_metrics=included_in_metrics,
                    skipped=False,
                    sample_time=sample_time,
                    message=sample_error or "",
                )
            )
            if len(batch) >= 50:
                flush_batch()

            yield self._json_line({
                "type": "progress",
                "index": processed,
                "total": total_prompts,
                "prompt": question,
                "expected_answer": true_final_answer,
                "model_response": model_response,
                "is_correct": is_correct,
                "sample_time": sample_time,
                "elapsed": round(time.perf_counter() - start_time, 3),
                "included_in_metrics": included_in_metrics,
                "message": sample_error or "",
                "running_metrics": {"accuracy": running_accuracy}
            })

        flush_batch()
        total_elapsed = round(time.perf_counter() - start_time, 3)
        summary = {
            "benchmark_type": "Math Reasoning (GSM8K)",
            "metrics": {"accuracy": round((correct / evaluated) * 100, 2) if evaluated else 0.0},
            "total_prompts": total_prompts,
            "evaluated_prompts": evaluated,
            "correct_answers": correct,
            "error_samples": error_samples,
            "model_name": model_name,
            "dataset_name": dataset_name,
            "elapsed_seconds": total_elapsed,
        }

        evaluation_record.evaluated_prompts = evaluated
        evaluation_record.correct_answers = correct
        evaluation_record.metrics = summary['metrics']
        evaluation_record.error_samples = error_samples
        evaluation_record.elapsed_seconds = total_elapsed
        evaluation_record.status = 'completed'
        evaluation_record.completed_at = timezone.now()
        evaluation_record.save(update_fields=[
            'evaluated_prompts',
            'correct_answers',
            'metrics',
            'error_samples',
            'elapsed_seconds',
            'status',
            'completed_at',
        ])

        summary['evaluation_id'] = evaluation_record.id

        yield self._json_line({
            "type": "summary",
            "result": summary
        })

    def _stream_classification(self, model_service, prompts, model_name, dataset_name, total_prompts, start_time, evaluation_record):
        processed = 0
        evaluated = 0
        tp = fp = tn = fn = 0
        error_samples = []
        batch = []

        def flush_batch():
            nonlocal batch
            if batch:
                DatasetEvaluationSample.objects.bulk_create(batch)
                batch = []

        for row in prompts:
            processed += 1
            text = row.get('text')
            label = row.get('label')
            if text is None or label is None:
                batch.append(
                    DatasetEvaluationSample(
                        result=evaluation_record,
                        index=processed,
                        prompt=text or "",
                        expected_answer="",
                        model_response="",
                        is_correct=None,
                        included_in_metrics=False,
                        skipped=True,
                        sample_time=None,
                        message="缺少 text 或 label 字段",
                    )
                )
                if len(batch) >= 50:
                    flush_batch()
                yield self._json_line({
                    "type": "progress",
                    "index": processed,
                    "total": total_prompts,
                    "skipped": True,
                    "message": "缺少 text 或 label 字段",
                    "elapsed": round(time.perf_counter() - start_time, 3)
                })
                continue

            try:
                label_int = int(label)
            except (ValueError, TypeError):
                batch.append(
                    DatasetEvaluationSample(
                        result=evaluation_record,
                        index=processed,
                        prompt=text or "",
                        expected_answer=str(label),
                        model_response="",
                        is_correct=None,
                        included_in_metrics=False,
                        skipped=True,
                        sample_time=None,
                        message="label 无法解析为整数",
                    )
                )
                if len(batch) >= 50:
                    flush_batch()
                yield self._json_line({
                    "type": "progress",
                    "index": processed,
                    "total": total_prompts,
                    "skipped": True,
                    "message": "label 无法解析为整数",
                    "elapsed": round(time.perf_counter() - start_time, 3)
                })
                continue

            prompt_to_model = "Analyze the sentiment of the following movie review. Respond with only the word 'positive' or 'negative'.\n\nReview: '" + text + "'"

            sample_started = time.perf_counter()
            predicted_label = None
            sample_error = None
            try:
                model_response = model_service.evaluate(prompt=prompt_to_model, model_name=model_name).lower()
                predicted_label = 1 if 'positive' in model_response else 0
            except Exception as exc:
                sample_error = f"API Error: {exc}"
                model_response = sample_error

            sample_time = round(time.perf_counter() - sample_started, 3)

            included_in_metrics = predicted_label is not None
            is_correct = None
            if included_in_metrics:
                evaluated += 1
                if predicted_label == 1 and label_int == 1:
                    tp += 1
                elif predicted_label == 1 and label_int == 0:
                    fp += 1
                elif predicted_label == 0 and label_int == 0:
                    tn += 1
                elif predicted_label == 0 and label_int == 1:
                    fn += 1

                is_correct = predicted_label == label_int
                if not is_correct and len(error_samples) < 5:
                    error_samples.append({
                        "prompt": text,
                        "expected_answer": "positive" if label_int == 1 else "negative",
                        "model_response": model_response
                    })
            else:
                if len(error_samples) < 5:
                    error_samples.append({
                        "prompt": text,
                        "expected_answer": "positive" if label_int == 1 else "negative",
                        "model_response": model_response
                    })

            accuracy = ((tp + tn) / evaluated * 100) if evaluated else 0.0
            precision = (tp / (tp + fp) * 100) if (tp + fp) else 0.0
            recall = (tp / (tp + fn) * 100) if (tp + fn) else 0.0
            f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

            batch.append(
                DatasetEvaluationSample(
                    result=evaluation_record,
                    index=processed,
                    prompt=text,
                    expected_answer="positive" if label_int == 1 else "negative",
                    model_response=model_response,
                    is_correct=is_correct if included_in_metrics else None,
                    included_in_metrics=included_in_metrics,
                    skipped=False,
                    sample_time=sample_time,
                    message=sample_error or ("" if included_in_metrics else "模型响应无效"),
                )
            )
            if len(batch) >= 50:
                flush_batch()

            yield self._json_line({
                "type": "progress",
                "index": processed,
                "total": total_prompts,
                "prompt": text,
                "expected_answer": "positive" if label_int == 1 else "negative",
                "model_response": model_response,
                "is_correct": is_correct,
                "sample_time": sample_time,
                "elapsed": round(time.perf_counter() - start_time, 3),
                "included_in_metrics": included_in_metrics,
                "message": sample_error or ("" if included_in_metrics else "模型响应无效"),
                "running_metrics": {
                    "accuracy": round(accuracy, 2),
                    "precision": round(precision, 2),
                    "recall": round(recall, 2),
                    "f1_score": round(f1, 2),
                }
            })

        flush_batch()
        total_elapsed = round(time.perf_counter() - start_time, 3)

        final_accuracy = ((tp + tn) / evaluated * 100) if evaluated else 0.0
        final_precision = (tp / (tp + fp) * 100) if (tp + fp) else 0.0
        final_recall = (tp / (tp + fn) * 100) if (tp + fn) else 0.0
        final_f1 = (2 * final_precision * final_recall / (final_precision + final_recall)) if (final_precision + final_recall) else 0.0

        summary = {
            "benchmark_type": "Sentiment Classification",
            "metrics": {
                "accuracy": round(final_accuracy, 2),
                "precision": round(final_precision, 2),
                "recall": round(final_recall, 2),
                "f1_score": round(final_f1, 2),
            },
            "total_prompts": total_prompts,
            "evaluated_prompts": evaluated,
            "correct_answers": int(tp + tn),
            "error_samples": error_samples,
            "model_name": model_name,
            "dataset_name": dataset_name,
            "elapsed_seconds": total_elapsed,
        }

        evaluation_record.evaluated_prompts = evaluated
        evaluation_record.correct_answers = int((tp + tn))
        evaluation_record.metrics = summary['metrics']
        evaluation_record.error_samples = error_samples
        evaluation_record.elapsed_seconds = total_elapsed
        evaluation_record.status = 'completed'
        evaluation_record.completed_at = timezone.now()
        evaluation_record.save(update_fields=[
            'evaluated_prompts',
            'correct_answers',
            'metrics',
            'error_samples',
            'elapsed_seconds',
            'status',
            'completed_at',
        ])

        summary['evaluation_id'] = evaluation_record.id

        yield self._json_line({
            "type": "summary",
            "result": summary
        })

    def _stream_generic_math(self, model_service, prompts, model_name, dataset_name, total_prompts, start_time, evaluation_record):
        correct = 0
        processed = 0
        error_samples = []
        batch = []

        def flush_batch():
            nonlocal batch
            if batch:
                DatasetEvaluationSample.objects.bulk_create(batch)
                batch = []

        for row in prompts:
            processed += 1
            question = row.get('problem')
            true_answer = row.get('answer')
            if not question or not true_answer:
                batch.append(
                    DatasetEvaluationSample(
                        result=evaluation_record,
                        index=processed,
                        prompt=question or "",
                        expected_answer="",
                        model_response="",
                        is_correct=None,
                        included_in_metrics=False,
                        skipped=True,
                        sample_time=None,
                        message="缺少 problem 或 answer 字段",
                    )
                )
                if len(batch) >= 50:
                    flush_batch()
                yield self._json_line({
                    "type": "progress",
                    "index": processed,
                    "total": total_prompts,
                    "skipped": True,
                    "message": "缺少 problem 或 answer 字段",
                    "elapsed": round(time.perf_counter() - start_time, 3)
                })
                continue

            prompt_to_model = question
            # Asymptote 渲染（可选）
            asy_match = re.search(r'\[asy\](.*?)\[/asy\]', question, re.DOTALL)
            if asy_match:
                asy_code = asy_match.group(1)
                prompt_to_model = re.sub(r'\[asy\].*?\[/asy\]', '', question, flags=re.DOTALL).strip()
                try:
                    with tempfile.NamedTemporaryFile(mode='w+', suffix='.asy', delete=True) as asy_file, \
                         tempfile.NamedTemporaryFile(suffix='.png', delete=True) as png_file:
                        asy_file.write(asy_code)
                        asy_file.flush()
                        command = ['asy', asy_file.name, '-f', 'png', '-o', png_file.name]
                        subprocess.run(command, check=True, timeout=15, capture_output=True)
                        with open(png_file.name, 'rb') as f_img:
                            image_base64 = base64.b64encode(f_img.read()).decode('utf-8')
                except FileNotFoundError:
                    image_base64 = None
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                    image_base64 = None

            sample_started = time.perf_counter()
            sample_error = None
            try:
                model_response = model_service.evaluate(
                    prompt=prompt_to_model,
                    model_name=model_name,
                )
            except Exception as exc:
                sample_error = f"API Error: {exc}"
                model_response = sample_error

            sample_time = round(time.perf_counter() - sample_started, 3)
            is_correct = None
            included_in_metrics = sample_error is None
            if included_in_metrics:
                try:
                    is_correct = self._check_math_answer(model_response, true_answer)
                except Exception:
                    is_correct = False

            if not is_correct and len(error_samples) < 5:
                error_samples.append({
                    "prompt": prompt_to_model,
                    "expected_answer": true_answer,
                    "model_response": model_response,
                })
            elif is_correct:
                correct += 1

            batch.append(
                DatasetEvaluationSample(
                    result=evaluation_record,
                    index=processed,
                    prompt=prompt_to_model,
                    expected_answer=true_answer,
                    model_response=model_response,
                    is_correct=is_correct,
                    included_in_metrics=included_in_metrics,
                    skipped=False,
                    sample_time=sample_time,
                    message=sample_error or "",
                )
            )
            if len(batch) >= 50:
                flush_batch()

            yield self._json_line({
                "type": "progress",
                "index": processed,
                "total": total_prompts,
                "prompt": prompt_to_model,
                "expected_answer": true_answer,
                "model_response": model_response,
                "is_correct": is_correct,
                "sample_time": sample_time,
                "elapsed": round(time.perf_counter() - start_time, 3),
                "included_in_metrics": included_in_metrics,
                "message": sample_error or "",
            })

        flush_batch()
        total_elapsed = round(time.perf_counter() - start_time, 3)
        accuracy = (correct / total_prompts * 100) if total_prompts else 0.0
        summary = {
            "benchmark_type": "General Math (with Vision)",
            "metrics": {"accuracy": round(accuracy, 2)},
            "total_prompts": total_prompts,
            "evaluated_prompts": total_prompts,  # 流模式下处理了全部
            "correct_answers": correct,
            "error_samples": error_samples,
            "model_name": model_name,
            "dataset_name": dataset_name,
            "elapsed_seconds": total_elapsed,
        }

        evaluation_record.evaluated_prompts = total_prompts
        evaluation_record.correct_answers = correct
        evaluation_record.metrics = summary['metrics']
        evaluation_record.error_samples = error_samples
        evaluation_record.elapsed_seconds = total_elapsed
        evaluation_record.status = 'completed'
        evaluation_record.completed_at = timezone.now()
        evaluation_record.save(update_fields=[
            'evaluated_prompts',
            'correct_answers',
            'metrics',
            'error_samples',
            'elapsed_seconds',
            'status',
            'completed_at',
        ])

        summary['evaluation_id'] = evaluation_record.id
        yield self._json_line({
            "type": "summary",
            "result": summary
        })

class DatasetEvaluationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        qs = DatasetEvaluationResult.objects.all()
        if not request.user.is_staff:
            qs = qs.filter(user=request.user)

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        mode_filter = request.query_params.get('mode')
        if mode_filter:
            qs = qs.filter(evaluation_mode=mode_filter)

        dataset_filter = request.query_params.get('dataset')
        if dataset_filter:
            qs = qs.filter(dataset_name=dataset_filter)

        model_filter = request.query_params.get('model')
        if model_filter:
            qs = qs.filter(model_name=model_filter)

        try:
            limit = int(request.query_params.get('limit', 20))
        except (TypeError, ValueError):
            limit = 20

        try:
            offset = int(request.query_params.get('offset', 0))
        except (TypeError, ValueError):
            offset = 0

        total_count = qs.count()
        qs = qs.order_by('-created_at')[offset:offset + limit]

        records = []
        for record in qs:
            records.append({
                "id": record.id,
                "dataset_name": record.dataset_name,
                "model_name": record.model_name,
                "evaluation_mode": record.evaluation_mode,
                "benchmark_type": record.benchmark_type,
                "status": record.status,
                "total_prompts": record.total_prompts,
                "evaluated_prompts": record.evaluated_prompts,
                "correct_answers": record.correct_answers,
                "metrics": record.metrics,
                "elapsed_seconds": record.elapsed_seconds,
                "created_at": record.created_at,
                "completed_at": record.completed_at,
            })

        return Response({
            "count": total_count,
            "limit": limit,
            "offset": offset,
            "results": records,
        })

class DatasetEvaluationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, evaluation_id, *args, **kwargs):
        evaluation = get_object_or_404(DatasetEvaluationResult, pk=evaluation_id)

        if not request.user.is_staff and evaluation.user_id != request.user.id:
            return Response({"error": "无权访问该测评记录"}, status=status.HTTP_403_FORBIDDEN)

        errors_only = request.query_params.get('errors_only', 'false').lower() in {'true', '1', 'yes'}

        try:
            limit = int(request.query_params.get('limit', 50))
        except (TypeError, ValueError):
            limit = 50

        try:
            offset = int(request.query_params.get('offset', 0))
        except (TypeError, ValueError):
            offset = 0

        samples_qs = evaluation.samples.all()
        if errors_only:
            samples_qs = samples_qs.filter(skipped=False, included_in_metrics=True).exclude(is_correct=True)

        total_samples = samples_qs.count()
        samples_slice = samples_qs[offset:offset + limit]

        samples_data = []
        for sample in samples_slice:
            samples_data.append({
                "index": sample.index,
                "prompt": sample.prompt,
                "expected_answer": sample.expected_answer,
                "model_response": sample.model_response,
                "is_correct": sample.is_correct,
                "included_in_metrics": sample.included_in_metrics,
                "skipped": sample.skipped,
                "sample_time": sample.sample_time,
                "message": sample.message,
            })

        payload = {
            "id": evaluation.id,
            "dataset_name": evaluation.dataset_name,
            "model_name": evaluation.model_name,
            "evaluation_mode": evaluation.evaluation_mode,
            "benchmark_type": evaluation.benchmark_type,
            "status": evaluation.status,
            "total_prompts": evaluation.total_prompts,
            "evaluated_prompts": evaluation.evaluated_prompts,
            "correct_answers": evaluation.correct_answers,
            "metrics": evaluation.metrics,
            "error_samples": evaluation.error_samples,
            "elapsed_seconds": evaluation.elapsed_seconds,
            "created_at": evaluation.created_at,
            "completed_at": evaluation.completed_at,
            "samples": samples_data,
            "pagination": {
                "total": total_samples,
                "limit": limit,
                "offset": offset,
                "errors_only": errors_only,
            },
        }

        return Response(payload)

    def _stream_classification(self, model_service, prompts, model_name, dataset_name, total_prompts, start_time, evaluation_record):
        processed = 0
        evaluated = 0
        tp = fp = tn = fn = 0
        error_samples = []
        batch = []

        def flush_batch():
            nonlocal batch
            if batch:
                DatasetEvaluationSample.objects.bulk_create(batch)
                batch = []

        for row in prompts:
            processed += 1
            text = row.get('text')
            label = row.get('label')
            if text is None or label is None:
                batch.append(
                    DatasetEvaluationSample(
                        result=evaluation_record,
                        index=processed,
                        prompt=text or "",
                        expected_answer="",
                        model_response="",
                        is_correct=None,
                        included_in_metrics=False,
                        skipped=True,
                        sample_time=None,
                        message="缺少 text 或 label 字段",
                    )
                )
                if len(batch) >= 50:
                    flush_batch()
                yield self._json_line({
                    "type": "progress",
                    "index": processed,
                    "total": total_prompts,
                    "skipped": True,
                    "message": "缺少 text 或 label 字段",
                    "elapsed": round(time.perf_counter() - start_time, 3)
                })
                continue

            try:
                label_int = int(label)
            except (ValueError, TypeError):
                batch.append(
                    DatasetEvaluationSample(
                        result=evaluation_record,
                        index=processed,
                        prompt=text or "",
                        expected_answer=str(label),
                        model_response="",
                        is_correct=None,
                        included_in_metrics=False,
                        skipped=True,
                        sample_time=None,
                        message="label 无法解析为整数",
                    )
                )
                if len(batch) >= 50:
                    flush_batch()
                yield self._json_line({
                    "type": "progress",
                    "index": processed,
                    "total": total_prompts,
                    "skipped": True,
                    "message": "label 无法解析为整数",
                    "elapsed": round(time.perf_counter() - start_time, 3)
                })
                continue

            prompt_to_model = "Analyze the sentiment of the following movie review. Respond with only the word 'positive' or 'negative'.\n\nReview: '" + text + "'"

            sample_started = time.perf_counter()
            predicted_label = None
            sample_error = None
            try:
                model_response = model_service.evaluate(prompt=prompt_to_model, model_name=model_name).lower()
                predicted_label = 1 if 'positive' in model_response else 0
            except Exception as exc:
                sample_error = f"API Error: {exc}"

                model_response = sample_error

            sample_time = round(time.perf_counter() - sample_started, 3)

            included_in_metrics = predicted_label is not None
            is_correct = None
            if included_in_metrics:
                evaluated += 1
                if predicted_label == 1 and label_int == 1:
                    tp += 1
                elif predicted_label == 1 and label_int == 0:
                    fp += 1
                elif predicted_label == 0 and label_int == 0:
                    tn += 1
                elif predicted_label == 0 and label_int == 1:
                    fn += 1

                is_correct = predicted_label == label_int
                if not is_correct and len(error_samples) < 5:
                    error_samples.append({
                        "prompt": text,
                        "expected_answer": "positive" if label_int == 1 else "negative",
                        "model_response": model_response
                    })
            else:
                if len(error_samples) < 5:
                    error_samples.append({
                        "prompt": text,
                        "expected_answer": "positive" if label_int == 1 else "negative",
                        "model_response": model_response
                    })

            accuracy = ((tp + tn) / evaluated * 100) if evaluated else 0.0
            precision = (tp / (tp + fp) * 100) if (tp + fp) else 0.0
            recall = (tp / (tp + fn) * 100) if (tp + fn) else 0.0
            f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

             # store sample
            batch.append(
                DatasetEvaluationSample(
                    result=evaluation_record,
                    index=processed,
                    prompt=text,
                    expected_answer="positive" if label_int == 1 else "negative",
                    model_response=model_response,
                    is_correct=is_correct if included_in_metrics else None,
                    included_in_metrics=included_in_metrics,
                    skipped=False,
                    sample_time=sample_time,
                    message=sample_error or ("" if included_in_metrics else "模型响应无效"),
                )
            )
            if len(batch) >= 50:
                flush_batch()

            yield self._json_line({
                "type": "progress",
                "index": processed,
                "total": total_prompts,
                "prompt": text,
                "expected_answer": "positive" if label_int == 1 else "negative",
                "model_response": model_response,
                "is_correct": is_correct,
                "sample_time": sample_time,
                "elapsed": round(time.perf_counter() - start_time, 3),
                "included_in_metrics": included_in_metrics,
                "message": sample_error or ("" if included_in_metrics else "模型响应无效"),
                "running_metrics": {
                    "accuracy": round(accuracy, 2),
                    "precision": round(precision, 2),
                    "recall": round(recall, 2),
                    "f1_score": round(f1, 2),
                }
            })

        flush_batch()
        total_elapsed = round(time.perf_counter() - start_time, 3)

        final_accuracy = ((tp + tn) / evaluated * 100) if evaluated else 0.0
        final_precision = (tp / (tp + fp) * 100) if (tp + fp) else 0.0
        final_recall = (tp / (tp + fn) * 100) if (tp + fn) else 0.0
        final_f1 = (2 * final_precision * final_recall / (final_precision + final_recall)) if (final_precision + final_recall) else 0.0

        summary = {
            "benchmark_type": "Sentiment Classification",
            "metrics": {
                "accuracy": round(final_accuracy, 2),
                "precision": round(final_precision, 2),
                "recall": round(final_recall, 2),
                "f1_score": round(final_f1, 2),
            },
            "total_prompts": total_prompts,
            "evaluated_prompts": evaluated,
            "correct_answers": int(tp + tn),
            "error_samples": error_samples,
            "model_name": model_name,
            "dataset_name": dataset_name,
            "elapsed_seconds": total_elapsed,
        }

        evaluation_record.evaluated_prompts = evaluated
        evaluation_record.correct_answers = int((tp + tn))
        evaluation_record.metrics = summary['metrics']
        evaluation_record.error_samples = error_samples
        evaluation_record.elapsed_seconds = total_elapsed
        evaluation_record.status = 'completed'
        evaluation_record.completed_at = timezone.now()
        evaluation_record.save(update_fields=[
            'evaluated_prompts',
            'correct_answers',
            'metrics',
            'error_samples',
            'elapsed_seconds',
            'status',
            'completed_at',
        ])

        summary['evaluation_id'] = evaluation_record.id

        yield self._json_line({
            "type": "summary",
            "result": summary
        })

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
