
import apiClient from './apiClient';

// 合并两边 API：保留双方功能并提供向后兼容的 helper

export const fetchForumPosts = (params = {}) => {
  return apiClient.get('/forum/posts/', { params });
};

export const fetchForumPost = (postId) => {
  return apiClient.get(`/forum/posts/${postId}/`);
};

// 兼容命名：shallcheer 使用 fetchForumPostDetail
export const fetchForumPostDetail = (postId) => fetchForumPost(postId);

export const createForumPost = (payload = {}) => {
  // payload 可以是普通对象或包含 files 的对象（images/attachments）
  if (payload instanceof FormData) {
    return apiClient.post('/forum/posts/', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  const { images, attachments, tags, ...rest } = payload;
  const hasFiles = (Array.isArray(images) && images.length) || (Array.isArray(attachments) && attachments.length);
  if (hasFiles) {
    const formData = new FormData();
    Object.keys(rest).forEach((k) => formData.append(k, rest[k]));
    if (Array.isArray(tags)) {
      formData.append('tags', JSON.stringify(tags));
    }
    (images || []).forEach((f) => formData.append('images', f));
    (attachments || []).forEach((f) => formData.append('attachments', f));
    return apiClient.post('/forum/posts/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  return apiClient.post('/forum/posts/', { tags, ...rest });
};

export const updateForumPost = (postId, payload = {}) => {
  if (payload instanceof FormData) {
    return apiClient.patch(`/forum/posts/${postId}/`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  const { images, attachments, ...rest } = payload;
  const hasFiles = (Array.isArray(images) && images.length) || (Array.isArray(attachments) && attachments.length);
  if (hasFiles) {
    const formData = new FormData();
    Object.keys(rest).forEach((k) => formData.append(k, rest[k]));
    (images || []).forEach((f) => formData.append('images', f));
    (attachments || []).forEach((f) => formData.append('attachments', f));
    return apiClient.patch(`/forum/posts/${postId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return apiClient.patch(`/forum/posts/${postId}/`, payload);
};

export const deleteForumPost = (postId) => apiClient.delete(`/forum/posts/${postId}/`);

export const fetchForumComments = (postId, params = {}) =>
  apiClient.get(`/forum/posts/${postId}/comments/`, { params });

export const createForumComment = (postId, payload = {}) => {
  // payload 可以是 { content, parent, images } 或 FormData 或普通 JSON
  if (payload instanceof FormData) {
    return apiClient.post(`/forum/posts/${postId}/comments/`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  const { content, parent, images, ...rest } = payload;
  const hasFiles = Array.isArray(images) && images.length;
  if (hasFiles) {
    const formData = new FormData();
    formData.append('content', content || '');
    if (parent) formData.append('parent', parent);
    images.forEach((f) => formData.append('images', f));
    Object.keys(rest).forEach((k) => formData.append(k, rest[k]));
    return apiClient.post(`/forum/posts/${postId}/comments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return apiClient.post(`/forum/posts/${postId}/comments/`, { content, parent, ...rest });
};

export const updateForumComment = (commentId, payload) => apiClient.patch(`/forum/comments/${commentId}/`, payload);

export const deleteForumComment = (commentId) => apiClient.delete(`/forum/comments/${commentId}/`);

export const toggleForumPostLike = (postId) => apiClient.post(`/forum/posts/${postId}/like/`);

export const toggleForumCommentLike = (commentId) => apiClient.post(`/forum/comments/${commentId}/like/`);

export const reactToForumPost = (postId, payload) => apiClient.post(`/forum/posts/${postId}/reactions/`, payload);

export const reactToForumComment = (commentId, payload) => apiClient.post(`/forum/comments/${commentId}/reactions/`, payload);

export const shareForumPost = (postId, payload = {}) => apiClient.post(`/forum/posts/${postId}/share/`, payload);

export const incrementForumPostView = (postId) => apiClient.post(`/forum/posts/${postId}/view/`);

export const fetchForumCategories = () => apiClient.get('/forum/categories/');

export const fetchForumTags = () => apiClient.get('/forum/tags/');

export const uploadForumAttachment = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post('/forum/attachments/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteForumAttachment = (attachmentId) => apiClient.delete(`/forum/attachments/${attachmentId}/`);

