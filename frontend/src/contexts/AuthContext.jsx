import React, { createContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';
import { jwtDecode } from 'jwt-decode';
import { getProfile, fetchNotifications } from '../api/users';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // 完整用户资料（包含描述、头像等）
  const [rawTokenUser, setRawTokenUser] = useState(null); // 解码 token 的最小信息
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const applyAccessToken = (access) => {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
    try {
      setRawTokenUser(jwtDecode(access));
    } catch (e) {
      console.error('无法解码 Access Token', e);
    }
  };

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setLoadingProfile(true);
    try {
      applyAccessToken(token);
      const res = await getProfile();
      setUser(res.data);
    } catch (e) {
      console.warn('获取用户资料失败', e);
      // 如果 token 过期或无效,清除本地存储
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
        logout();
      }
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetchNotifications();
      // 后端返回 {results: [...], unread_count: n}
      setNotifications(res.data.results || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (e) {
      console.warn('加载通知失败', e);
    }
  }, []);

  const login = async (username, password) => {
    try {
  const response = await apiClient.post('token/', { username, password });
      const { access, refresh } = response.data;
      if (access && refresh) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        applyAccessToken(access);
        await loadProfile();
        await loadNotifications();
        return true;
      }
      return false;
    } catch (error) {
      console.error('登录失败', error);
      // 提取后端友好错误信息（兼容两边）
      const errorMsg =
        error?.response?.data?.detail ||
        (Array.isArray(error?.response?.data?.non_field_errors) && error.response.data.non_field_errors.join(' ')) ||
        error?.response?.data ||
        error?.message ||
        '登录失败，请检查用户名和密码';
      // 清理本地 token（保持 HEAD 的行为），然后抛出带有详细信息的错误（保持 shallcheer 的行为）
      try {
        logout();
      } catch (e) {
        // ignore
      }
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
    setRawTokenUser(null);
    setNotifications([]);
    setUnreadCount(0);
  };

  const register = async (payload) => {
    try {
      const res = await apiClient.post('/users/register/', payload);
      try {
        await login(payload.username, payload.password);
        return { success: true, autoLogin: true, raw: res };
      } catch (e) {
        return { success: true, autoLogin: false, raw: res, loginError: e.message };
      }
    } catch (err) {
      // 更详细地返回后端错误，便于前端展示
      const status = err.response ? err.response.status : null;
      const data = err.response && err.response.data ? err.response.data : null;
      console.error('Register error response:', status, data || err.message);
      return {
        success: false,
        // 兼容旧版和新版：返回标准化的对象，并保留原始错误文本
        status: err.response ? err.response.status : null,
        errors: err.response && err.response.data ? err.response.data : { message: err.message },
        errors_raw: err.response && err.response.data ? JSON.stringify(err.response.data) : err.message,
        raw: err,
      };
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  useEffect(() => {
    // 初始化加载资料与通知（如果已登录）
    const initAuth = async () => {
      try {
        await loadProfile();
        await loadNotifications();
      } catch (error) {
        console.error('初始化认证失败:', error);
        // 不阻止应用渲染,只是记录错误
      }
    };
    initAuth();
  }, [loadProfile, loadNotifications]);

  const authContextValue = {
    user,
    rawTokenUser,
    notifications,
    unreadCount,
    login,
    logout,
    register,
    refreshProfile,
    loadNotifications,
    loadingProfile,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;