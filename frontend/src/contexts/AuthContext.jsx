import React, { createContext, useState, useEffect } from 'react';
import request from '../api/request';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // try to fetch current user profile
      request.get('users/me/').then((res) => setUser(res.data)).catch(() => setUser(null));
    }
  }, []);

  const login = async (username, password) => {
    const res = await request.post('token/', { username, password });
    if (res.data.access) {
      localStorage.setItem('token', res.data.access);
      // load user
      const profile = await request.get('users/me/');
      setUser(profile.data);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const register = async (payload) => {
    const res = await request.post('users/', payload);
    return res;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
