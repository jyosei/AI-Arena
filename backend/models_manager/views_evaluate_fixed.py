class EvaluateModelView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        model_name = request.data.get("model_name")
        prompt = request.data.get("prompt")
        conversation_id = request.data.get("conversation_id")  # 可选的对话 ID

        if not model_name or not prompt:
            return Response({"error": "model_name and prompt are required."}, status=400)

        try:
            from .models import ChatConversation, ChatMessage
            
            model_service = get_model_service(model_name)
            
            # 获取或创建 conversation
            if conversation_id:
                # 使用现有的对话
                try:
                    conversation = ChatConversation.objects.get(id=conversation_id)
                except ChatConversation.DoesNotExist:
                    return Response({"error": "Conversation not found."}, status=404)
            else:
                # 创建新对话
                conversation = ChatConversation.objects.create(
                    title=f"{model_name} 对话",
                    model_name=model_name
                )
            
            # 保存用户消息
            ChatMessage.objects.create(
                conversation=conversation,
                role='user',
                content=prompt
            )
            
            # 调用模型
            response_text = model_service.evaluate(prompt, model_name) 
            
            # 保存 AI 响应
            ChatMessage.objects.create(
                conversation=conversation,
                role='assistant',
                content=response_text
            )
            
            return Response({
                "prompt": prompt,
                "model": model_name,
                "response": response_text,
                "conversation_id": conversation.id
            })
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            # 将内部错误包装起来，提供更友好的提示
            # 注意：在生产环境中，不应暴露详细的内部错误 e
            return Response({"error": f"服务器内部错误: {e}"}, status=500)
