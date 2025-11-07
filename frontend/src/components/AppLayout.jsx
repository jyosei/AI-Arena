import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar } from 'antd';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { EditOutlined, TrophyOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';

const { Sider, Content, Header } = Layout;

// 模拟的聊天记录数据
const chatHistory = [
  { id: 1, title: '你好' },
  { id: 2, title: '生成清华大学二校门' },
  { id: 3, title: 'write a poem about a...' },
  { id: 4, title: 'who is the best ai' },
];

// 模拟的用户信息和登录状态
const mockUser = {
  isLoggedIn: true, // 改为 false 来查看登录按钮
  email: 'duwenyu93@gmail.com',
};

const AppLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // 在这里处理登出逻辑，例如清除 token
    console.log('User logged out');
    navigate('/login'); // 跳转到登录页
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={260} style={{ background: '#f7f7f8', borderRight: '1px solid #e8e8e8' }}>
        <div style={{ padding: '16px', height: '64px', display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
            AI Arena
          </Link>
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['1']}
          style={{ background: '#f7f7f8', borderRight: 0 }}
          items={[
            {
              key: '1',
              icon: <EditOutlined />,
              label: <Link to="/">New Chat / Models</Link>,
            },
            {
              key: '2',
              icon: <TrophyOutlined />,
              label: <Link to="/leaderboard">Leaderboard</Link>,
            },
          ]}
        />
        <div style={{ padding: '0 16px', marginTop: '24px' }}>
          <p style={{ color: '#8c8c8c', fontSize: '12px' }}>Chat History</p>
          {chatHistory.map(chat => (
            <div key={chat.id} style={{ padding: '8px', borderRadius: '4px', cursor: 'pointer', hover: { background: '#e6f7ff' } }}>
              {chat.title}
            </div>
          ))}
        </div>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {mockUser.isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{mockUser.email}</span>
              <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : (
            <Button type="primary" onClick={() => navigate('/login')}>
              Login
            </Button>
          )}
        </Header>
        <Content style={{ margin: '24px', background: '#fff', padding: '24px', borderRadius: '8px' }}>
          {/* 子路由的页面内容会在这里渲染 */}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;