import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：在每次请求前都附上 Access Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：处理 Access Token 过期问题
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // --- 关键修改：确保 error.response 存在，并且状态码是 401 ---
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      
      // 避免对刷新请求本身进行重试
      if (originalRequest.url === '/token/refresh/') {
        console.error("Refresh token is invalid or expired. Redirecting to login.");
        // 在这里处理登出逻辑，例如清除 token 并跳转页面
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // window.location.href = '/login'; 
        return Promise.reject(error);
      }

      originalRequest._retry = true; // 标记为已重试

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          console.error("No refresh token available.");
          return Promise.reject(error);
        }

        // 使用 refresh token 请求新的 access token
        const response = await apiClient.post('/token/refresh/', {
          refresh: refreshToken,
        });
        
        const newAccessToken = response.data.access;

        // 更新 localStorage 和 apiClient 的默认头
        localStorage.setItem('access_token', newAccessToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

        // 重新发起原始请求
        return apiClient(originalRequest);

      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        // 清除本地存储的 token
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // 对于其他错误（包括网络错误、非401错误等），直接拒绝
    return Promise.reject(error);
  }
);

export default apiClient;