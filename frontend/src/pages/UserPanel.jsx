import React, { useContext } from 'react';
import { Card, Button } from 'antd';
import AuthContext from '../contexts/AuthContext.jsx';

export default function UserPanel() {
  const { user, logout } = useContext(AuthContext);

  if (!user) return <Card>未登录</Card>;

  return (
    <Card title="用户面板">
      <p>用户名: {user.username}</p>
      <p>邮箱: {user.email || '-'}</p>
      <p>权限: {user.is_staff ? '管理员' : '普通用户'}</p>
      <Button danger onClick={logout}>登出</Button>
    </Card>
  );
}
