import React from 'react';
import { Layout, Menu, Dropdown, Button, Avatar, Space, Select, Typography } from 'antd';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMode } from '../contexts/ModeContext';
import { 
  EditOutlined, 
  TrophyOutlined, 
  UserOutlined, 
  LogoutOutlined, 
  ThunderboltOutlined, 
  TableOutlined, 
  MessageOutlined, 
  DownOutlined 
} from '@ant-design/icons';

import{
    Swords,
    Columns2,
    SendHorizontal,
}from 'lucide-react';
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

// 菜单项定义
const menuItems = [
  { key: 'battle', label: <span className = "menu-font-label">Battle</span>, icon: <Swords size={16}/> },
  { key: 'side-by-side', label: <span className = "menu-font-label">Side by side</span>, icon: <Columns2 size={16}/> },
  { key: 'direct-chat', label: <span className = "menu-font-label">Direct chat</span>, icon: <SendHorizontal size={16}/> },
];

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode, models, leftModel, setLeftModel, rightModel, setRightModel } = useMode();

  const handleLogout = () => {
    // 在这里处理登出逻辑，例如清除 token
    console.log('User logged out');
    navigate('/login'); // 跳转到登录页
  };

  const handleMenuClick = (e) => {
    setMode(e.key);
  };

  const menu = <Menu onClick={handleMenuClick} items={menuItems} />;
  const currentModeItem = menuItems.find(item => item.key === mode);
  const currentModeIcon = currentModeItem ? currentModeItem.icon : null;
  const currentModeLabel = currentModeItem ? currentModeItem.label : 'Select Mode';

  const modelOptions = models.map(m => ({ label: m.name, value: m.name }));

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
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <Space size="large">
            <Dropdown overlay={menu}>
              <Button size="large">
                <Space align="center">
                  {currentModeIcon}
                  {currentModeLabel}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>

            {mode === 'side-by-side' && (
              <>
                <Select
                  showSearch
                  placeholder="选择左侧模型"
                  value={leftModel}
                  onChange={setLeftModel}
                  style={{ width: 180 }}
                  options={modelOptions}
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
                <Typography.Text strong>VS</Typography.Text>
                <Select
                  showSearch
                  placeholder="选择右侧模型"
                  value={rightModel}
                  onChange={setRightModel}
                  style={{ width: 180 }}
                  options={modelOptions}
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </>
            )}
            {mode === 'direct-chat' && (
              <Select
                showSearch
                placeholder="选择一个模型"
                value={leftModel}
                onChange={setLeftModel}
                style={{ width: 180 }}
                options={modelOptions}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            )}
          </Space>

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
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;