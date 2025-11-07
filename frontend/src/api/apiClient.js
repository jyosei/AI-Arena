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

    // 关键修改：如果请求本身就是去刷新 token，或者状态码不是 401，就直接失败，不要进入刷新逻辑
    if (originalRequest.url === '/token/refresh/' || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        console.error("No refresh token available for refresh attempt.");
        // 如果没有刷新令牌，直接拒绝，不要再尝试了
        return Promise.reject(error);
      }

      // 调用刷新 token 的接口
      const { data } = await apiClient.post('/token/refresh/', {
        refresh: refreshToken,
      });

      // 刷新成功，更新 localStorage 中的 access token
      localStorage.setItem('access_token', data.access);

      // 更新原始请求的 Authorization 头并重新发送
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access}`;
      originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
      return apiClient(originalRequest);

    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      // 如果刷新也失败了，清除所有令牌
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // 可以选择在这里跳转到登录页面
      // window.location.href = '/login';
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;