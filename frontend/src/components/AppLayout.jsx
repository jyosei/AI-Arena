import React from 'react';
import { Layout, Menu, Dropdown, Button, Avatar, Space, Select, Typography, Form, Input, Modal, message } from 'antd';
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
import RegisterModal from './RegisterModal';
import { useIntl } from 'react-intl';
import AuthContext from '../contexts/AuthContext.jsx';
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
  const [showRegister, setShowRegister] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);
  const intl = useIntl();
  const { login, logout, user } = React.useContext(AuthContext);
  const isLoggedIn = !!user;
  const userEmail = user?.email || user?.username || '';

  const handleLogout = () => {
    logout();
    message.success('已登出');
  };

  const handleMenuClick = (e) => {
    setMode(e.key);
  };

  const menu = <Menu onClick={handleMenuClick} items={menuItems} />;
  const currentModeItem = menuItems.find(item => item.key === mode);
  const currentModeIcon = currentModeItem ? currentModeItem.icon : null;
  const currentModeLabel = currentModeItem ? currentModeItem.label : 'Select Mode';

  const modelOptions = models.map(m => ({ label: m.name, value: m.name }));

  // 登录弹窗表单内容
  const LoginForm = () => {
    const [loading, setLoading] = React.useState(false);
    const [form] = Form.useForm();
    const onFinish = async (values) => {
      setLoading(true);
      try {
        const ok = await login(values.username, values.password);
        if (ok) {
          message.success(intl.formatMessage({ id: 'login.success', defaultMessage: '登录成功' }));
          setIsLoggedIn(true);
          setUserEmail(values.username);
          setShowLogin(false);
        } else {
          message.error(intl.formatMessage({ id: 'login.failed', defaultMessage: '登录失败' }));
        }
      } catch (e) {
        console.error(e);
        message.error(intl.formatMessage({ id: 'login.error', defaultMessage: '登录出错' }));
      } finally {
        setLoading(false);
      }
    };
    return (
      <Form form={form} name="login" layout="vertical" onFinish={onFinish}>
        <Form.Item name="username" label={intl.formatMessage({ id: 'login.username.label', defaultMessage: '用户名' })} rules={[{ required: true, message: intl.formatMessage({ id: 'login.username.required', defaultMessage: '请输入用户名' }) }]}> <Input placeholder={intl.formatMessage({ id: 'login.username.placeholder', defaultMessage: '用户名' })} /> </Form.Item>
        <Form.Item name="password" label={intl.formatMessage({ id: 'login.password.label', defaultMessage: '密码' })} rules={[{ required: true, message: intl.formatMessage({ id: 'login.password.required', defaultMessage: '请输入密码' }) }]}> <Input.Password placeholder={intl.formatMessage({ id: 'login.password.placeholder', defaultMessage: '密码' })} /> </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>{intl.formatMessage({ id: 'login.button', defaultMessage: '登录' })}</Button>
        </Form.Item>
      </Form>
    );
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

          {isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#1890ff' }} />
              <span style={{ fontWeight: 500, fontSize: 16 }}>{userEmail}</span>
              <Button icon={<LogoutOutlined />} shape="round" type="default" style={{ borderRadius: 20, fontWeight: 500 }} onClick={handleLogout}>
                退出登录
              </Button>
            </div>
          ) : (
            <Space size="middle">
              <Button type="primary" shape="round" style={{ borderRadius: 20, fontWeight: 500, minWidth: 90 }} onClick={() => setShowLogin(true)}>
                登录
              </Button>
              <Button shape="round" style={{ borderRadius: 20, fontWeight: 500, minWidth: 90, background: '#f0f5ff', color: '#1890ff', border: 'none' }} onClick={() => setShowRegister(true)}>
                注册
              </Button>
            </Space>
          )}
          {/* 注册弹窗 */}
          <RegisterModal visible={showRegister} onClose={() => setShowRegister(false)} />
          {/* 登录弹窗美化 */}
          <Modal
            title={<div style={{ textAlign: 'center', fontWeight: 600, fontSize: 20 }}><UserOutlined style={{ color: '#1890ff', marginRight: 8 }} />登录</div>}
            open={showLogin}
            onCancel={() => setShowLogin(false)}
            footer={null}
            destroyOnClose
            centered
            bodyStyle={{ padding: '32px 32px 16px 32px', borderRadius: 16 }}
          >
            <div style={{ maxWidth: 360, margin: '0 auto' }}>
              <LoginForm />
            </div>
          </Modal>
        </Header>
        <Content style={{ margin: '24px', background: '#fff', padding: '24px', borderRadius: '8px' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;