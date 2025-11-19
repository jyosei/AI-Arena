from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny # 导入 AllowAny
from rest_framework.parsers import FormParser
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from .services import get_model_service
from .models import BattleVote
from .models import ChatConversation
from .models import ChatMessage
from .serializers import ChatConversationSerializer
from .serializers import ChatMessageSerializer
import random
import time
import base64

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
        valid_winners.extend(['tie', 'bad', 'good'])

        if winner not in valid_winners:
            return Response({'error': f'Invalid winner. Must be one of {valid_winners}'}, status=status.HTTP_400_BAD_REQUEST)

        # 创建并保存投票记录
        BattleVote.objects.create(
            model_a=model_a,
            model_b=model_b, # 可以为 null
            prompt=prompt,
            winner=winner,
            # voter=request.user if request.user.is_authenticated else None
        )

        return Response(status=status.HTTP_200_OK)
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
            {"id": 2, "name": "gpt-5", "owner_name": "OpenAI", "task": "通用"},
            {"id": 3, "name": "gpt-5.1", "owner_name": "OpenAI", "task": "通用"},
            {"id": 4, "name": "gpt-5-codex", "owner_name": "OpenAI", "task": "通用"},
            {"id": 5, "name": "gpt-5-mini", "owner_name": "OpenAI", "task": "通用"},
            {"id": 6, "name": "gpt-5-search-api", "owner_name": "OpenAI", "task": "通用"},
            {"id": 7, "name": "dall-e-3", "owner_name": "OpenAI", "task": "image"},
            {"id": 8, "name": "gpt-4", "owner_name": "OpenAI", "task": "通用"},
            {"id": 9, "name": "gpt-4-turbo", "owner_name": "OpenAI", "task": "通用"},
            {"id": 10, "name": "gpt-4.1", "owner_name": "OpenAI", "task": "通用"},
            {"id": 11, "name": "gpt-4o-mini", "owner_name": "OpenAI", "task": "通用"},
            {"id": 12, "name": "claude-haiku-4-5-20251001", "owner_name": "Anthropic", "task": "通用"},
            {"id": 13, "name": "claude-opus-4-20245014-thinking", "owner_name": "Anthropic", "task": "通用"},
            {"id": 14, "name": "claude-3-sonnet-20240229", "owner_name": "Anthropic", "task": "通用"},
            {"id": 15, "name": "veo_3_1-fast", "owner_name": "google", "task": "通用"},
            {"id": 16, "name": "gemini-2.0-flash", "owner_name": "Google", "task": "通用"},
            {"id": 17, "name": "gemini-2.5-flash", "owner_name": "Google", "task": "image"},
            {"id": 18, "name": "gemini-2.5-flash-image", "owner_name": "Google", "task": "通用"},
            {"id": 19, "name": "gemini-2.5-pro", "owner_name": "Google", "task": "通用"},
            {"id": 20, "name": "glm-4", "owner_name": "ZhipuAI", "task": "通用"},
            {"id": 21, "name": "glm-4.5", "owner_name": "ZhipuAI", "task": "通用"},
            {"id": 22, "name": "deepseek-chat", "owner_name": "深度求索", "task": "代码"},
            {"id": 23, "name": "deepseek-ocr", "owner_name": "深度求索", "task": "代码"},
            {"id": 24, "name": "deepseek-r1", "owner_name": "深度求索", "task": "代码"},
            {"id": 25, "name": "kimi-k2", "owner_name": "Moonshot", "task": "代码"},
            {"id": 26, "name": "doubao-1-5-pro-32k-character-250228", "owner_name": "Doubao", "task": "代码"},
            {"id": 27, "name": "llama-2-13b", "owner_name": "Ollama", "task": "代码"},
            {"id": 28, "name": "qwen-max", "owner_name": "阿里巴巴", "task": "通用"},
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
            
            # --- 获取或创建对话 ---
            if conversation_id:
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
        conv = ChatConversation.objects.create(user=request.user, title=title, model_name=model_name)
        serializer = ChatConversationSerializer(conv)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DeleteAllConversationsView(APIView):
    """删除当前用户的所有会话（谨慎调用）。"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        ChatConversation.objects.filter(user=request.user).delete()
        return Response({'message': 'deleted'}, status=status.HTTP_200_OK)


class DeleteConversationView(APIView):
    """删除单个会话。"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, conversation_id, *args, **kwargs):
        try:
            conv = ChatConversation.objects.get(id=conversation_id, user=request.user)
            conv.delete()
            return Response({'message': 'deleted'}, status=status.HTTP_200_OK)
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

        if not conversation_id or not content:
            return Response({'error': 'conversation_id and content are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            conv = ChatConversation.objects.get(id=conversation_id, user=request.user)
        except ChatConversation.DoesNotExist:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

        message = ChatMessage.objects.create(conversation=conv, content=content, is_user=is_user)
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