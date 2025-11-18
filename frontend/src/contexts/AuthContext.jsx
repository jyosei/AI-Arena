import React, { createContext, useState, useEffect } from 'react';
import request from '../api/request';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      // try to fetch current user profile
      // 后端提供的 profile 接口为 users/profile/
      request.get('users/profile/').then((res) => setUser(res.data)).catch(() => setUser(null));
    }
  }, []);

  const login = async (username, password) => {
    try {
      console.log('Sending login request...');
      const res = await request.post('token/', { username, password });
      console.log('Login response:', res.data);
      
      if (res.data && res.data.access) {
        localStorage.setItem('access_token', res.data.access);
        localStorage.setItem('refresh_token', res.data.refresh);
        
        // 设置默认的 Authorization header
        request.defaults.headers.common['Authorization'] = `Bearer ${res.data.access}`;
        
        // 获取用户资料
        console.log('Fetching user profile...');
        try {
          const profile = await request.get('users/profile/');
          console.log('Profile response:', profile.data);
          setUser(profile.data);
          return true;
        } catch (profileError) {
          console.error('Profile fetch error:', profileError);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          throw new Error('无法获取用户资料');
        }
      }
      return false;
    } catch (error) {
      console.error('Login error:', error.response || error);
      // 转发错误到上层以显示具体错误信息
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
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
