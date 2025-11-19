import React, { createContext, useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { jwtDecode } from 'jwt-decode'; // 确保已安装 jwt-decode

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decodedUser = jwtDecode(token);
        setUser(decodedUser);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Token decoding failed:', error);
        logout();
      }
    }
  }, []);

  const login = async (username, password) => {
    try {
      const response = await apiClient.post('/token/', { username, password });
      
      const { access, refresh } = response.data;

      if (access && refresh) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);

        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        
        const decodedUser = jwtDecode(access);
        setUser(decodedUser);
        
        return true;
      }
      return false;

    } catch (error) {
      console.error('Login failed:', error);
      logout();
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const register = async (payload) => {
    try {
      const res = await apiClient.post('users/register/', payload);
      try {
        await login(payload.username, payload.password);
        return { success: true, autoLogin: true, raw: res };
      } catch (e) {
        return { success: true, autoLogin: false, raw: res, error: e };
      }
    } catch (err) {
      const payload = {
        success: false,
        status: err.response ? err.response.status : null,
        errors: err.response && err.response.data ? err.response.data : err.message,
        raw: err,
      };
      return payload;
    }
  };

  const authContextValue = {
    user,
    login,
    logout,
    register,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;