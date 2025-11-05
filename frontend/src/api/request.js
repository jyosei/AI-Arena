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
	const token = localStorage.getItem('token');
	if (token) {
		config.headers = config.headers || {};
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

export default request;