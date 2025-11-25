import React from 'react';
import { Layout, Menu, Dropdown, Button, Avatar, Space, Select, Typography, Form, Input, Modal, message, Tooltip, Radio } from 'antd';
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
  UploadOutlined
} from '@ant-design/icons';
import{
    Swords,
    Columns2,
    SendHorizontal,
}from 'lucide-react';
import RegisterModal from './RegisterModal';
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
  const intl = useIntl();
  const { login, logout, user } = React.useContext(AuthContext);
  const isLoggedIn = !!user;
  // 新建会话弹窗状态与临时选择
  const [showNewChatModal, setShowNewChatModal] = React.useState(false);
  const [creatingChat, setCreatingChat] = React.useState(false);
  const [tempMode, setTempMode] = React.useState(mode);
  const [tempLeftModel, setTempLeftModel] = React.useState(leftModel);
  const [tempRightModel, setTempRightModel] = React.useState(rightModel);
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
  };
  
  // 根据当前路径获取应高亮的 key
  let currentKey = '1'; // 默认
  if (location.pathname.startsWith('/chat/')) {
    currentKey = '1';
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

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发导航
    try {
      await deleteChat(chatId);
      message.success('已删除聊天记录');
      // 如果删除的是当前正在查看的聊天，导航到首页
      if (location.pathname === `/chat/${chatId}`) {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      message.error('删除失败');
    }
  };

  const openNewChatModal = () => {
    setTempMode(mode);
    setTempLeftModel(leftModel || (models[0]?.name ?? null));
    setTempRightModel(rightModel || (models[1]?.name ?? null));
    setShowNewChatModal(true);
  };

  const handleConfirmNewChat = async () => {
    // battle 模式不需要选择模型
    if (tempMode !== 'battle' && !tempLeftModel) {
      message.warning('请选择模型');
      return;
    }
    // side-by-side 模式需要选择两个模型
    if (tempMode === 'side-by-side' && !tempRightModel) {
      message.warning('Side by side 模式需要选择两个模型');
      return;
    }
    setCreatingChat(true);
    try {
      setMode(tempMode);
      setLeftModel(tempLeftModel);
      if (tempMode === 'side-by-side') {
        setRightModel(tempRightModel);
      }
      // 构造 model_name：side-by-side 需要 "modelA vs modelB" 格式
      let modelNameForChat = tempLeftModel;
      if (tempMode === 'side-by-side') {
        modelNameForChat = `${tempLeftModel} vs ${tempRightModel}`;
      } else if (tempMode === 'battle') {
        // battle 模式可以传 null 或随机选择
        modelNameForChat = null;
      }
      const newChatId = await addChat('新会话', modelNameForChat, tempMode);
      if (newChatId) {
        navigate(`/chat/${newChatId}`);
        message.success('会话已创建');
      }
      setShowNewChatModal(false);
    } catch (error) {
      console.error('Failed to create new chat:', error);
      message.error('创建新会话失败');
    } finally {
      setCreatingChat(false);
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
          // --- 3. 更新高亮逻辑 ---
          selectedKeys={[currentKey]} // <-- 使用动态计算的 key
          style={{ background: '#f7f7f8', borderRight: 0 }}
          // --- 4. 添加 "社区论坛" 菜单项 ---
          items={[
            {
              key: '1',
              icon: <EditOutlined />,
              // 使用 onClick 处理新建会话
              label: <span onClick={openNewChatModal}>新对话</span>,
            },
            {
              key: '2',
              icon: <TrophyOutlined />,
              // 使用 Link 组件包裹，使其可以点击跳转
              label: <Link to="/leaderboard">排行榜</Link>,
            },
            { // <-- 这是新添加的项
              key: '3',
              icon: <MessageOutlined />,
              label: <Link to="/forum">社区论坛</Link>,
            },
            { // <-- 这是新添加的项
              key: '4',
              icon: <UploadOutlined />,
              label: <Link to="/evaluate-dataset">上传数据集</Link>,
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
            <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                  onClick={() => navigate(`/chat/${chat.id}`)}
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
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#000' }}>
            AI Arena
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
          <Modal
            title={<div style={{ fontWeight: 600 }}>新建会话</div>}
            open={showNewChatModal}
            onCancel={() => setShowNewChatModal(false)}
            onOk={handleConfirmNewChat}
            okText={creatingChat ? '创建中...' : '开始会话'}
            confirmLoading={creatingChat}
            destroyOnClose
          >
            {models.length === 0 ? (
              <div style={{ padding: '12px 0' }}>暂无可用模型，请稍后再试。</div>
            ) : (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Typography.Text>选择模式：</Typography.Text>
                  <Radio.Group
                    value={tempMode}
                    onChange={(e) => setTempMode(e.target.value)}
                    style={{ marginTop: 8 }}
                  >
                    <Radio.Button value="battle">Battle</Radio.Button>
                    <Radio.Button value="side-by-side">Side by side</Radio.Button>
                    <Radio.Button value="direct-chat">Direct chat</Radio.Button>
                  </Radio.Group>
                </div>
                {tempMode === 'battle' ? (
                  <Typography.Text type="secondary">
                    Battle 模式将随机匹配模型进行对战，无需手动选择。
                  </Typography.Text>
                ) : tempMode === 'side-by-side' ? (
                  <Space size="middle" wrap>
                    <Select
                      showSearch
                      placeholder="左侧模型"
                      value={tempLeftModel}
                      onChange={setTempLeftModel}
                      style={{ width: 180 }}
                      options={models.map(m => ({ label: m.name, value: m.name }))}
                    />
                    <Typography.Text strong>VS</Typography.Text>
                    <Select
                      showSearch
                      placeholder="右侧模型"
                      value={tempRightModel}
                      onChange={setTempRightModel}
                      style={{ width: 180 }}
                      options={models.map(m => ({ label: m.name, value: m.name }))}
                    />
                  </Space>
                ) : (
                  <Select
                    showSearch
                    placeholder="选择模型"
                    value={tempLeftModel}
                    onChange={setTempLeftModel}
                    style={{ width: 240 }}
                    options={models.map(m => ({ label: m.name, value: m.name }))}
                  />
                )}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {tempMode === 'battle' 
                    ? '点击"开始会话"进入 Battle 模式。' 
                    : '根据模式选择一个或两个模型，确认后进入聊天界面。'}
                </Typography.Text>
              </Space>
            )}
          </Modal>
        </Header>
        <Content style={{ 
          margin: '24px', 
          background: '#fff', 
          padding: '24px', 
          borderRadius: '8px',
          height: 'calc(100vh - 64px - 48px)', // 减去 Header 高度和 margin
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {shouldShowModelSelectors && (
            <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
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
            </div>
          )}
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;