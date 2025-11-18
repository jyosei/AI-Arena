import request from './request';

export const fetchForumPosts = (params = {}) =>
  request.get('forum/posts/', { params });

export const fetchForumPostDetail = (postId) =>
  request.get(`forum/posts/${postId}/`);

export const createForumPost = (payload) =>
  request.post('forum/posts/', payload);

export const updateForumPost = (postId, payload) =>
  request.patch(`forum/posts/${postId}/`, payload);

export const deleteForumPost = (postId) =>
  request.delete(`forum/posts/${postId}/`);

export const fetchForumComments = (postId) =>
  request.get(`forum/posts/${postId}/comments/`);

export const createForumComment = (postId, payload) =>
  request.post(`forum/posts/${postId}/comments/`, payload);

export const updateForumComment = (commentId, payload) =>
  request.patch(`forum/comments/${commentId}/`, payload);

export const deleteForumComment = (commentId) =>
  request.delete(`forum/comments/${commentId}/`);

export const reactToForumPost = (postId, payload) =>
  request.post(`forum/posts/${postId}/reactions/`, payload);

export const reactToForumComment = (commentId, payload) =>
  request.post(`forum/comments/${commentId}/reactions/`, payload);

export const shareForumPost = (postId, payload = {}) =>
  request.post(`forum/posts/${postId}/share/`, payload);

export const incrementForumPostView = (postId) =>
  request.post(`forum/posts/${postId}/view/`);

export const fetchForumCategories = () =>
  request.get('forum/categories/');

export const fetchForumTags = () =>
  request.get('forum/tags/');

export const uploadForumAttachment = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('forum/attachments/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteForumAttachment = (attachmentId) =>
  request.delete(`forum/attachments/${attachmentId}/`);
