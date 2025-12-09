import request from './request';

// 获取当前用户资料
export function getProfile() {
  return request.get('users/profile/');
}

// 更新用户资料（可包含 avatar_file 上传）
export function updateProfile(payload) {
  // 使用 FormData 以支持文件
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  return request.put('users/profile/', formData);
}

export function changePassword(current_password, new_password) {
  return request.post('users/change-password/', { current_password, new_password });
}

export function fetchNotifications({ unread } = {}) {
  const params = {};
  if (unread) params.unread = 'true';
  return request.get('users/notifications/', { params });
}

export function markNotificationRead(id) {
  return request.post(`users/notifications/${id}/read/`);
}

export function markAllNotificationsRead() {
  return request.post('users/notifications/mark-all-read/');
}

export function getFollowStatus(userId) {
  return request.get(`users/follows/${userId}/`);
}

export function followUser(userId) {
  return request.post(`users/follows/${userId}/`);
}

export function unfollowUser(userId) {
  return request.delete(`users/follows/${userId}/`);
}

export function getFollowList(type = 'following') {
  return request.get('users/follows/', { params: { type } });
}

export function getPrivateChatThreads() {
  return request.get('users/private-chats/');
}

export function getPrivateChatMessages(userId) {
  return request.get(`users/private-chats/${userId}/`);
}

export function sendPrivateChatMessage(userId, content) {
  return request.post(`users/private-chats/${userId}/`, { content });
}
