# 测试修复建议

## 1. Like API 端点 (优先级: 高)

### 问题
- `test_like_post`: 返回200而非201
- `test_cannot_like_twice`: 返回200而非409  
- `test_unlike_post`: 返回405 Method Not Allowed

### 原因
Like API可能没有正确实现POST/DELETE方法，或返回状态码不符合REST标准

### 修复方案

检查 `forum/views.py` 中的Like相关视图，确保：

```python
# 应该实现类似下面的逻辑
class PostLikeViewSet(viewsets.ViewSet):
    """帖子点赞视图"""
    
    def create(self, request, post_id):
        """创建点赞 - 返回201"""
        post = get_object_or_404(ForumPost, pk=post_id)
        
        # 检查是否已经点过赞
        reaction, created = ForumPostReaction.objects.get_or_create(
            post=post,
            user=request.user,
            defaults={'reaction_type': 'like'}
        )
        
        if not created:
            return Response(
                {'detail': '已经点过赞'},
                status=status.HTTP_409_CONFLICT
            )
        
        post.like_count += 1
        post.save()
        return Response(status=status.HTTP_201_CREATED)
    
    def destroy(self, request, post_id):
        """删除点赞 - 返回204"""
        post = get_object_or_404(ForumPost, pk=post_id)
        reaction = get_object_or_404(
            ForumPostReaction,
            post=post,
            user=request.user,
            reaction_type='like'
        )
        
        reaction.delete()
        post.like_count -= 1
        post.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

### 测试验证
```bash
python manage.py test test_suite.ForumIntegrationTests.test_like_post -v2
python manage.py test test_suite.ForumIntegrationTests.test_unlike_post -v2
python manage.py test test_suite.ForumIntegrationTests.test_cannot_like_twice -v2
```

---

## 2. 评论列表权限 (优先级: 高)

### 问题
- `test_get_comments_list`: 返回401 Unauthorized
- `test_nested_comments_flow`: 返回401 Unauthorized

### 原因
评论列表API可能要求认证，但测试没有提供token

### 修复方案

检查 `forum/urls.py` 中的评论列表路由，确保public权限或修改测试提供认证：

**选项A** - 修改API权限（推荐）
```python
# forum/views.py
class CommentViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 或 [IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        post_id = self.kwargs.get('post_id')
        return ForumComment.objects.filter(post_id=post_id)
```

**选项B** - 修改测试
```python
# test_suite.py
def test_get_comments_list(self):
    # ...
    response = self.client.get(
        f'/api/forum/posts/{post.id}/comments/',
        **self.auth_headers(self.token2)  # 添加认证
    )
```

### 测试验证
```bash
python manage.py test test_suite.ForumIntegrationTests.test_get_comments_list -v2
```

---

## 3. 用户关注API (优先级: 高)

### 问题
- `test_follow_user`: 返回404 Not Found
- `test_unfollow_user`: 返回404 Not Found
- `test_get_followers`: 返回404 Not Found
- `test_get_following`: 返回404 Not Found

### 原因
用户关注API端点未实现或URL路由错误

### 修复方案

在 `users/views.py` 中实现关注相关的视图：

```python
@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_follow_detail(request, user_id):
    """关注/取消关注用户"""
    target_user = get_object_or_404(User, pk=user_id)
    
    if request.method == 'POST':
        follow, created = UserFollow.objects.get_or_create(
            follower=request.user,
            following=target_user
        )
        if created:
            return Response(status=status.HTTP_201_CREATED)
        return Response({'detail': '已经关注'}, status=status.HTTP_409_CONFLICT)
    
    elif request.method == 'DELETE':
        follow = get_object_or_404(
            UserFollow,
            follower=request.user,
            following=target_user
        )
        follow.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

在 `users/urls.py` 中添加路由：

```python
urlpatterns = [
    path('users/<int:user_id>/follow/', user_follow_detail),
    path('users/<int:user_id>/followers/', user_followers_list),
    path('users/<int:user_id>/following/', user_following_list),
]
```

### 测试验证
```bash
python manage.py test test_suite.UserFollowIntegrationTests -v2
```

---

## 4. 帖子更新 (优先级: 中)

### 问题
- `test_update_own_post`: 更新未生效

### 原因
PATCH方法未正确更新字段或权限检查失败

### 修复方案

检查 `forum/views.py` 中的Post更新逻辑：

```python
class PostViewSet(viewsets.ModelViewSet):
    def update(self, request, *args, **kwargs):
        post = self.get_object()
        
        # 检查权限
        if post.author != request.user:
            raise PermissionDenied()
        
        # 部分更新
        if 'title' in request.data:
            post.title = request.data['title']
        if 'content' in request.data:
            post.content = request.data['content']
        
        post.save()
        return Response(PostSerializer(post).data)
```

### 测试验证
```bash
python manage.py test test_suite.ForumIntegrationTests.test_update_own_post -v2
```

---

## 5. 视图计数 (优先级: 中)

### 问题
- `test_get_post_detail`: view_count 未增加

### 原因
Post详情视图未实现浏览计数增加逻辑

### 修复方案

在 `forum/views.py` 中的retrieve方法中添加：

```python
class PostViewSet(viewsets.ModelViewSet):
    def retrieve(self, request, *args, **kwargs):
        post = self.get_object()
        
        # 增加浏览次数
        post.view_count += 1
        post.save(update_fields=['view_count'])
        
        return Response(PostSerializer(post).data)
```

### 测试验证
```bash
python manage.py test test_suite.ForumIntegrationTests.test_get_post_detail -v2
```

---

## 6. 密码修改端点 (优先级: 中)

### 问题
- `test_change_password`: 返回400 Bad Request

### 原因
端点可能不存在或参数格式不匹配

### 修复方案

在 `users/views.py` 中实现：

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """修改用户密码"""
    user = request.user
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not old_password or not new_password:
        return Response(
            {'detail': '缺少密码字段'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not user.check_password(old_password):
        return Response(
            {'detail': '旧密码不正确'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user.set_password(new_password)
    user.save()
    
    return Response({'detail': '密码已修改'}, status=status.HTTP_200_OK)
```

在 `users/urls.py` 添加：
```python
urlpatterns = [
    path('users/change-password/', change_password),
]
```

### 测试验证
```bash
python manage.py test test_suite.UserProfileIntegrationTests.test_change_password -v2
```

---

## 完整修复顺序

1. ✅ **第一步**: 修复Like API端点 (完成后: 3个测试通过)
2. ✅ **第二步**: 修复评论列表权限 (完成后: 2个测试通过)
3. ✅ **第三步**: 实现用户关注API (完成后: 4个测试通过)
4. ✅ **第四步**: 修复帖子更新 (完成后: 1个测试通过)
5. ✅ **第五步**: 实现视图计数 (完成后: 1个测试通过)
6. ✅ **第六步**: 实现密码修改端点 (完成后: 1个测试通过)

### 预期结果
完成上述所有修复后，测试成功率应达到 **95%+** (50/53+ 通过)

---

## 验证命令

```bash
# 运行所有失败的测试
npm run test:all

# 运行单个测试文件
python manage.py test test_suite -v2

# 生成测试报告
coverage run --source='.' manage.py test test_suite
coverage html
```

