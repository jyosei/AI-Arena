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
  return request.put('users/profile/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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
