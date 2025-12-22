#!/usr/bin/env python
import re

with open('test_suite.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace ForumPostLike with ForumPostReaction
content = content.replace(
    'from forum.models import ForumPost, ForumCategory, ForumTag, ForumComment, ForumPostLike',
    'from forum.models import ForumPost, ForumCategory, ForumTag, ForumComment, ForumPostReaction, ForumCommentLike, ForumPostFavorite'
)

# Replace ForumPostLike references with ForumPostReaction
content = content.replace(
    'ForumPostLike.objects.create',
    'ForumPostReaction.objects.create'
)

# Fix the ForumPostReaction calls to include reaction_type
# Pattern 1: ForumPostReaction.objects.create(post=post, user=self.user2) -> add reaction_type='like'
content = re.sub(
    r'ForumPostReaction\.objects\.create\(post=([^,]+), user=([^)]+)\)',
    r'ForumPostReaction.objects.create(post=\1, user=\2, reaction_type=\'like\')',
    content
)

# Pattern 2: ForumPostReaction.objects.create(post=self.post, user=user) -> add reaction_type='like'
content = re.sub(
    r'ForumPostReaction\.objects\.create\(post=([^,]+), user=([^,)]+)\)',
    r'ForumPostReaction.objects.create(post=\1, user=\2, reaction_type=\'like\')',
    content
)

# Replace category=self.category with category_obj=self.category
content = content.replace('category=self.category', 'category_obj=self.category')

with open('test_suite.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('All replacements completed successfully')
