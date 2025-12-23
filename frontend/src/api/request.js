// 文件：request.js (请确认已修改)

import axios from 'axios';

// 计算 API base URL：优先使用 Vite 的 VITE_API_BASE 构建时变量，其次回退到 REACT_APP_API_BASE（兼容旧配置），最后使用相对路径 '/api/'。
const getBaseURL = () => {
	try {
		if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
			return import.meta.env.VITE_API_BASE;
		}
	} catch (e) {
		// ignore
	}
	if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) {
		return process.env.REACT_APP_API_BASE;
	}
	return '/api/';
};

const baseURL = getBaseURL();
const request = axios.create({ baseURL });

// 请求拦截器：统一附上 access token（使用统一的 localStorage key）
request.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('access_token');
		if (token) {
			config.headers = config.headers || {};
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

// 响应拦截器：处理 401 并尝试刷新 token
request.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config || {};

		// 保护性检查：确保有 response
		if (error && error.response && error.response.status === 401 && !originalRequest._retry) {
			// 防止对刷新请求本身进行重试
			const refreshPaths = ['/token/refresh/', 'token/refresh/', `${baseURL}token/refresh/`];
			const reqUrl = originalRequest.url || '';
			if (refreshPaths.includes(reqUrl) || refreshPaths.includes(originalRequest.url)) {
				// 刷新请求本身已失败，直接登出
				localStorage.removeItem('access_token');
				localStorage.removeItem('refresh_token');
				return Promise.reject(error);
			}

			originalRequest._retry = true;

			try {
				const refreshToken = localStorage.getItem('refresh_token');
				if (!refreshToken) {
					return Promise.reject(error);
				}

				// 使用绝对路径调用刷新接口，避免 baseURL 拼接导致的问题
				const refreshUrl = baseURL.replace(/\/$/, '') + '/token/refresh/';
				const res = await axios.post(refreshUrl, { refresh: refreshToken });

				if (res && res.data && res.data.access) {
					const newAccess = res.data.access;
					localStorage.setItem('access_token', newAccess);
					// 更新当前实例与原始请求的 header
					request.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
					originalRequest.headers = originalRequest.headers || {};
					originalRequest.headers.Authorization = `Bearer ${newAccess}`;
					return request(originalRequest);
				}
			} catch (e) {
				// 刷新失败 -> 清理并让上层处理
				console.error('Token refresh failed in request.js:', e);
				localStorage.removeItem('access_token');
				localStorage.removeItem('refresh_token');
				return Promise.reject(e);
			}
		}

		return Promise.reject(error);
	}
);

export default request;