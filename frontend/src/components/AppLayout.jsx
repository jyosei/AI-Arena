import React from 'react';
import { Layout, Menu, Dropdown, Button, Avatar, Space, Select, Typography, Form, Input, Modal, message, Tooltip, Divider } from 'antd';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMode } from '../contexts/ModeContext';
import { useChat } from '../contexts/ChatContext';
import { 
  EditOutlined, 
  TrophyOutlined, 
  UserOutlined, 
  LogoutOutlined, 
  MessageOutlined, // <-- 确保这个图标已导入
  DownOutlined,
  DeleteOutlined,
  CloseOutlined,
  MenuOutlined,
  UploadOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import{
    Swords,
    Columns2,
    SendHorizontal,
}from 'lucide-react';
import RegisterModal from './RegisterModal';
import GitHubLogin from './GitHubLogin.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useIntl } from 'react-intl';
import AuthContext from '../contexts/AuthContext.jsx';
import { resolveMediaUrl } from '../utils/media';
const { Sider, Content, Header } = Layout;

// 菜单项定义
const menuItems = [
  { key: 'battle', label: <span className = "menu-font-label">Battle</span>, icon: <Swords size={16}/> },
  { key: 'side-by-side', label: <span className = "menu-font-label">Side by side</span>, icon: <Columns2 size={16}/> },
  { key: 'direct-chat', label: <span className = "menu-font-label">Direct chat</span>, icon: <SendHorizontal size={16}/> },
];

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation(); // <-- 1. 获取 location
  const { mode, setMode, models, leftModel, setLeftModel, rightModel, setRightModel } = useMode();
  const { chatHistory, clearHistory, addChat, deleteChat } = useChat();
  const [showRegister, setShowRegister] = React.useState(false);
  const [showLogin, setShowLogin] = React.useState(false);
  const [mobileSiderOpen, setMobileSiderOpen] = React.useState(false);
  const intl = useIntl();
  const { login, logout, user } = React.useContext(AuthContext);
  const isLoggedIn = !!user;
  // 取消弹窗式新建会话，改为跳转到首页
  const userEmail = user?.email || user?.username || '';
  const navigateToUserCenter = React.useCallback(() => {
    navigate('/user-center');
  }, [navigate]);

  const avatarSrc = React.useMemo(() => {
    if (!user) return '';
    const raw = user.avatar_url || user.avatar;
    if (!raw) return '';
    return resolveMediaUrl(raw);
  }, [user?.avatar_url, user?.avatar]);

  // --- 2. 添加菜单高亮逻辑 ---
  // 定义路由路径和菜单项 key 的映射
  const pathKeyMap = {
    '/': '1',
    '/leaderboard': '2',
    '/forum': '3',
    '/evaluate-dataset': '4',
    '/evaluate-dataset/history': '5',
  };
  
  // 根据当前路径获取应高亮的 key
  let currentKey = '1'; // 默认
  if (location.pathname.startsWith('/chat/')) {
    currentKey = '1';
  } else if (location.pathname === '/forum') {
    currentKey = '3';
  } else if (location.pathname.startsWith('/forum/')) {
    currentKey = '3';
  } else {
    currentKey = pathKeyMap[location.pathname] || '1';
  }
  
  // 判断当前页面是否应该显示模式和模型选择器
  const shouldShowModelSelectors = location.pathname === '/' || location.pathname.startsWith('/chat/');
  // ---

  const handleLogout = () => {
    logout();
    message.success('已登出');
  };

  // 原先弹窗相关逻辑已移除

  // 仍需保留的辅助方法
  const closeMobileSider = () => {
    setMobileSiderOpen(false);
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    try {
      await deleteChat(chatId);
      message.success('已删除聊天记录');
      if (location.pathname === `/chat/${chatId}`) {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      message.error('删除失败');
    }
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
    const handleSubmit = () => {
      form.validateFields()
        .then(async (values) => {
          setLoading(true);
          try {
            const ok = await login(values.username, values.password);
            if (ok) {
              message.success('登录成功！');
              setShowLogin(false);
              form.resetFields();
            } else {
              message.error('用户名或密码错误');
            }
          } catch (e) {
            const errorMsg = e.response?.data?.detail || e.response?.data?.error || '登录失败，请重试';
            message.error(errorMsg);
          } finally {
            setLoading(false);
          }
        })
        .catch(() => {
          // 表单验证失败
        });
    };

    return (
      <Form form={form} name="login" layout="vertical" onFinish={handleSubmit}>
        <Form.Item 
          name="username" 
          label="用户名"
          validateTrigger="onBlur"
          rules={[
            { 
              required: true,
              message: '请输入用户名'
            },
            {
              min: 3,
              message: '用户名至少3个字符'
            }
          ]}
        >
          <Input placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item 
          name="password" 
          label="密码"
          validateTrigger="onBlur"
          rules={[
            { 
              required: true,
              message: '请输入密码'
            },
            {
              min: 6,
              message: '密码至少6个字符'
            }
          ]}
        >
          <Input.Password placeholder="请输入密码" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>{intl.formatMessage({ id: 'login.button', defaultMessage: '登录' })}</Button>
        </Form.Item>
        <Divider plain style={{ margin: '12px 0' }}>或</Divider>
        <GitHubLogin buttonText="使用 GitHub 登录" buttonProps={{ type: 'default', style: { borderRadius: 20 } }} />
      </Form>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 移动端遮罩 */}
      <div 
        className={`mobile-sider-mask ${mobileSiderOpen ? 'visible' : ''}`}
        onClick={closeMobileSider}
      />
      <Sider 
        width={260} 
        style={{ background: '#f7f7f8', borderRight: '1px solid #e8e8e8' }}
        className={mobileSiderOpen ? 'mobile-sider-open' : ''}
      >
        <div style={{ padding: '16px', height: '64px', display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
            AI Arena
          </Link>
        </div>
        <Menu
          mode="inline"
          // --- 3. 更新高亮逻辑 ---
          selectedKeys={[currentKey]} // <-- 使用动态计算的 key
          style={{ background: '#f7f7f8', borderRight: 0 }}
          // --- 4. 添加 "社区论坛" 菜单项 ---
          items={[
            {
              key: '1',
              icon: <EditOutlined />,
              // 将点击行为绑定到整块菜单项
              onClick: () => { navigate('/'); closeMobileSider(); },
              label: '新建会话',
            },
            {
              key: '2',
              icon: <TrophyOutlined />,
              // 使用 Link 组件包裹，使其可以点击跳转
              label: <Link to="/leaderboard" onClick={closeMobileSider}>排行榜</Link>,
            },
            { // <-- 这是新添加的项
              key: '3',
              icon: <MessageOutlined />,
              label: <Link to="/forum" onClick={closeMobileSider}>社区论坛</Link>,
            },
            { // 上传数据集菜单项
              key: '4',
              icon: <UploadOutlined />,
              label: <Link to="/evaluate-dataset" onClick={closeMobileSider}>数据集测评</Link>,
            },
            {
              key: '5',
              icon: <HistoryOutlined />,
              label: <Link to="/evaluate-dataset/history" onClick={closeMobileSider}>测评历史</Link>,
            },
          ]}
          // ---
        />
        <div style={{ padding: '0 16px', marginTop: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px' 
          }}>
            <p style={{ 
              color: '#8c8c8c', 
              fontSize: '13px', 
              fontWeight: 500,
              margin: 0 
            }}>聊天记录</p>
            {chatHistory.length > 0 && (
              <Button 
                type="text" 
                size="small"
                style={{ color: '#8c8c8c', fontSize: '12px' }}
                onClick={() => clearHistory()}
              >
                清除记录
              </Button>
            )}
          </div>
          {chatHistory.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#8c8c8c', 
              fontSize: '14px',
              padding: '32px 0' 
            }}>
              <MessageOutlined style={{ fontSize: '24px', marginBottom: '8px', display: 'block' }} />
              暂无聊天记录
            </div>
          ) : (
            <div className="chat-history-container" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {chatHistory.map(chat => (
                <div 
                  key={chat.id} 
                  style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    marginBottom: '8px',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    background: location.pathname === `/chat/${chat.id}` ? '#f0f0f0' : 'transparent'
                  }}
                  className="chat-history-item"
                  onClick={() => { navigate(`/chat/${chat.id}`); closeMobileSider(); }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== `/chat/${chat.id}`) {
                      e.currentTarget.style.background = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== `/chat/${chat.id}`) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ 
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1f1f1f',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    paddingRight: '24px'
                  }}>
                    {chat.title}
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: '#8c8c8c',
                    marginTop: '4px'
                  }}>
                    {chat.time || '刚刚'}
                  </div>
                  <CloseOutlined 
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '12px',
                      color: '#8c8c8c',
                      padding: '4px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#000';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#8c8c8c';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileSiderOpen(!mobileSiderOpen)}
              style={{ 
                fontSize: '20px',
                width: '40px',
                height: '40px',
                display: 'none'
              }}
              className="mobile-menu-btn"
            />
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#000' }}>
              AI Arena
            </div>
          </div>

          {isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <NotificationBell />
              <Tooltip title="个人中心">
                <Avatar
                  src={avatarSrc || undefined}
                  icon={avatarSrc ? undefined : <UserOutlined />}
                  style={{
                    background: avatarSrc ? '#f5f5f5' : '#000',
                    cursor: 'pointer',
                  }}
                  size={40}
                  onClick={navigateToUserCenter}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigateToUserCenter();
                    }
                  }}
                  tabIndex={0}
                />
              </Tooltip>
              <span className="header-user-email" style={{ fontWeight: 500, fontSize: 16 }}>{userEmail}</span>
              <Button icon={<LogoutOutlined />} shape="round" type="default" style={{ borderRadius: 20, fontWeight: 500 }} onClick={handleLogout}>
                <span className="logout-btn-text">退出登录</span>
              </Button>
            </div>
          ) : (
            <Space size="middle">
              <Button type="primary" shape="round" style={{ borderRadius: 20, fontWeight: 500, minWidth: 90 }} onClick={() => setShowLogin(true)}>
                登录
              </Button>
              <Button shape="round" style={{ borderRadius: 20, fontWeight: 500, minWidth: 90, background: '#f5f5f5', color: '#000', border: '1px solid #d9d9d9' }} onClick={() => setShowRegister(true)}>
                注册
              </Button>
            </Space>
          )}
          {/* 注册弹窗 */}
          <RegisterModal 
            visible={showRegister} 
            onClose={() => setShowRegister(false)} 
            onShowLogin={() => {
              setShowRegister(false);
              setShowLogin(true);
            }}
          />
          {/* 登录弹窗美化 */}
          <Modal
            title={<div style={{ textAlign: 'center', fontWeight: 600, fontSize: 20 }}><UserOutlined style={{ color: '#000', marginRight: 8 }} />登录</div>}
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
          {/* 新建会话弹窗已删除，改为直接导航到首页 */}
        </Header>
        <Content style={{ 
          margin: '24px', 
          padding: '0 0 32px',
          minHeight: 'calc(100vh - 64px - 48px)',
          background: 'transparent'
        }}>
          <div className="app-content-shell">
            {shouldShowModelSelectors && (
              <div className="app-content-toolbar">
              <Space size="large" className="model-selector-space">
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
              </div>
            )}
            <div className="app-content-body">
              <Outlet />
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;