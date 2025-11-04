import axios from 'axios';

const apiClient = axios.create({
  // 你的后端 API 的基础 URL
  // 在 Docker Compose 环境中，Nginx 通常会将 /api 代理到后端
  baseURL: '/api', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加一个请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 从 localStorage 中获取 token
    const token = localStorage.getItem('access_token');
    if (token) {
      // 如果 token 存在，则添加到 Authorization 请求头中
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // 对请求错误做些什么
    return Promise.reject(error);
  }
);

export default apiClient;