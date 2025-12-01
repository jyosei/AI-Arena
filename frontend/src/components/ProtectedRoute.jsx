import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import AuthContext from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, isInitializing } = useContext(AuthContext);
  
  // 等待初始化完成
  if (isInitializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="正在加载..." />
      </div>
    );
  }
  
  // 初始化完成后，如果没有用户则跳转登录
  if (!user) return <Navigate to="/login" replace />;
  
  return children;
}
