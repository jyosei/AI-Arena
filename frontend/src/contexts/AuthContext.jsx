import React, { createContext, useState, useEffect } from 'react';
import request from '../api/request';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // try to fetch current user profile
      // 后端提供的 profile 接口为 users/profile/
      request.get('users/profile/').then((res) => setUser(res.data)).catch(() => setUser(null));
    }
  }, []);

  const login = async (username, password) => {
    try {
      const res = await request.post('token/', { username, password });
      if (res.data && res.data.access) {
        localStorage.setItem('token', res.data.access);
        // load user from backend profile endpoint
        const profile = await request.get('users/profile/');
        setUser(profile.data);
        return true;
      }
      return false;
    } catch (e) {
      // 登录失败（例如 401），不要抛出到上层，返回 false
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const register = async (payload) => {
    // 后端用户注册接口为 users/register/
    try {
      const res = await request.post('users/register/', payload);
      // 如果注册成功，尝试自动登录（如果后端允许返回 token）
      try {
        await login(payload.username, payload.password);
        return { success: true, autoLogin: true, raw: res };
      } catch (e) {
        // 注册成功但自动登录失败（例如后端不返回 token）
        return { success: true, autoLogin: false, raw: res, error: e };
      }
    } catch (err) {
      // 统一返回错误结构，便于前端显示后端返回的错误信息
      const payload = {
        success: false,
        status: err.response ? err.response.status : null,
        errors: err.response && err.response.data ? err.response.data : err.message,
        raw: err,
      };
      return payload;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
