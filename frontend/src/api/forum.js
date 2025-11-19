import apiClient from './apiClient';

export const fetchForumPosts = (params = {}) => {
  return apiClient.get('/forum/posts/', { params });
};

export const fetchForumPost = (postId) => {
  return apiClient.get(`/forum/posts/${postId}/`);
};

export const createForumPost = ({ title, content, category, tags = [], images = [] }) => {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('content', content);
  formData.append('category', category);
  if (Array.isArray(tags)) {
    formData.append('tags', JSON.stringify(tags));
  }
  images.forEach((file) => {
    formData.append('images', file);
  });

  return apiClient.post('/forum/posts/', formData);
};

export const createForumComment = (postId, { content, parent = null, images = [] }) => {
  const formData = new FormData();
  formData.append('content', content);
  if (parent) formData.append('parent', parent);
  if (Array.isArray(images)) {
    images.forEach(file => {
      if (file instanceof File) {
        formData.append('images', file);
      }
    });
  }
  return apiClient.post(`/forum/posts/${postId}/comments/`, formData);
};

export const toggleForumPostLike = (postId) => {
  return apiClient.post(`/forum/posts/${postId}/like/`);
};

export const toggleForumCommentLike = (commentId) => {
  return apiClient.post(`/forum/comments/${commentId}/like/`);
};
