from rest_framework import generics, permissions
from rest_framework.response import Response
from .models import User  # 从 users 应用自己的 models 导入 User
from .serializers import UserSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            response = super().create(request, *args, **kwargs)
            return response
        except Exception as e:
            if hasattr(e, 'detail'):
                return Response({'error': e.detail}, status=400)
            return Response({'error': str(e)}, status=400)

class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
