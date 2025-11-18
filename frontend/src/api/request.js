// 文件：request.js (请确认已修改)

import axios from 'axios';

// 计算 API base URL：优先使用 Vite 的 VITE_API_BASE 构建时变量，其次回退到 REACT_APP_API_BASE（兼容旧配置），最后使用相对路径 '/api/'，方便在 nginx 反向代理下工作。
const getBaseURL = () => {
	try {
		// Vite 提供 import.meta.env
		if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
			return import.meta.env.VITE_API_BASE;
		}
	} catch (e) {
		// ignore
	}
	if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) {
		return process.env.REACT_APP_API_BASE;
	}
	// 最安全的默认：在同域下使用相对路径
	return '/api/';
};

const request = axios.create({ baseURL: getBaseURL() });

// request interceptor: attach token if available
request.interceptors.request.use((config) => {
	const token = localStorage.getItem('access_token');
	if (token) {
		config.headers = config.headers || {};
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
}, (error) => {
	return Promise.reject(error);
});

// 响应拦截器
request.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;
		
		// 如果是 401 错误并且不是刷新 token 的请求
		if (error.response.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;
			
			try {
				// 尝试使用 refresh token 获取新的 access token
				const refreshToken = localStorage.getItem('refresh_token');
				if (refreshToken) {
					const res = await axios.post('api/token/refresh/', {
						refresh: refreshToken
					});
					
					if (res.data.access) {
						localStorage.setItem('token', res.data.access);
						// 更新原始请求的 Authorization header
						originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
						return request(originalRequest);
					}
				}
			} catch (error) {
				// 如果刷新失败，清除所有 token
				localStorage.removeItem('token');
				localStorage.removeItem('refresh');
			}
		}
		
		return Promise.reject(error);
	}
);

export default request;