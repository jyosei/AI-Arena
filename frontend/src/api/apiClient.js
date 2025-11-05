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

    // 如果是401错误且不是重试请求
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          // 如果没有 refresh token，我们什么也做不了
          console.error("No refresh token available.");
          // 在没有登录页面的情况下，我们先只在控制台报错
          return Promise.reject(error);
        }

        // 调用刷新 token 的接口
        const { data } = await apiClient.post('/token/refresh/', {
          refresh: refreshToken,
        });

        // 刷新成功，更新 localStorage 中的 access token
        localStorage.setItem('access_token', data.access);

        // 更新原始请求的 Authorization 头并重新发送
        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
        return apiClient(originalRequest);

      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        // 如果刷新也失败了，清除所有令牌
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;