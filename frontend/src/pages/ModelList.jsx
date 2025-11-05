import React, { useEffect, useState } from 'react';
import { Card, Input, Select, List, Button, Spin, Modal, Typography, Row, Col, Space, Avatar } from 'antd';
import { Link } from 'react-router-dom';
import { SearchOutlined, TrophyOutlined, SwapOutlined, TeamOutlined, MessageOutlined, UserOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
// 导入新的 API 函数
import { getModels, evaluateModel } from '../api/models';
import axios from 'axios'
const { Search, TextArea } = Input;
const { Title, Paragraph } = Typography;
// 聊天对话框组件
// 接收 model 属性
function ChatDialog({ visible, onClose, model }) { // 确保接收 model prop
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim() || !model) return;

    const userMessage = { content: inputValue, isUser: true };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setLoading(true);
    
    try {
      // 使用导入的 evaluateModel 函数，它内部会通过 apiClient 发送请求
      const response = await evaluateModel(model.name, currentInput);
      
      const aiMessage = { content: response.data.response, isUser: false };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      const errorMessage = { content: `调用模型出错: ${error.response?.data?.detail || error.message}`, isUser: false };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={model ? `💬 与 ${model.name} 对话` : '💬 与 AI 对话'}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', border: '1px solid #f0f0f0', marginBottom: 16 }}>
          {messages.map((msg, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <Avatar icon={msg.isUser ? <UserOutlined /> : <RobotOutlined />} style={{ order: msg.isUser ? 2 : 1, marginLeft: msg.isUser ? 8 : 0, marginRight: msg.isUser ? 0 : 8 }} />
              <div style={{ background: msg.isUser ? '#1890ff' : '#f5f5f5', color: msg.isUser ? 'white' : 'black', padding: '8px 12px', borderRadius: '8px', maxWidth: '70%' }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && <Spin style={{ marginLeft: 40 }} />}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <TextArea value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="输入您的问题..." onPressEnter={e => !e.shiftKey && (e.preventDefault(), handleSend())} />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!inputValue.trim() || loading}>发送</Button>
        </div>
      </div>
    </Modal>
  );
}


export default function ModelList() {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [chatVisible, setChatVisible] = useState(false);
  // 新增 state 用于存储当前选择用于聊天的模型
  const [selectedModelForChat, setSelectedModelForChat] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getModels({ search: query, type: filter === 'all' ? undefined : filter });
      setModels(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetch(); 
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setWelcomeModalVisible(true);
      localStorage.setItem('hasSeenWelcome', 'true');
    }
  }, []);

  const handleWelcomeOk = () => {
    setWelcomeModalVisible(false);
  };

  const handleWelcomeCancel = () => {
    setWelcomeModalVisible(false);
  };

  const handleSearch = (value) => {
    setQuery(value);
    fetch();
  };

  const features = [
    {
      icon: <SwapOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
      title: '比较模型',
      description: '对比不同AI模型的性能和表现，找到最适合您需求的模型'
    },
    {
      icon: <TrophyOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
      title: '排行榜',
      description: '查看模型在各项任务中的排名和评分'
    },
    {
      icon: <TeamOutlined style={{ fontSize: '24px', color: '#faad14' }} />,
      title: '社区评价',
      description: '基于真实用户反馈和测试结果的评分系统'
    }
  ];

  return (
    <>
      {/* Hero Section */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '80px 24px',
          textAlign: 'center',
          color: 'white',
          borderRadius: '8px',
          marginBottom: '48px',
          position: 'relative'
        }}
      >
        <Title level={1} style={{ color: 'white', marginBottom: '16px' }}>
          Find the Best AI for You
        </Title>
        <Paragraph style={{ 
          fontSize: '18px', 
          color: 'rgba(255, 255, 255, 0.9)',
          marginBottom: '32px',
          maxWidth: '600px',
          margin: '0 auto 32px'
        }}>
          Compare answers across top AI models, share your feedback and power our public leaderboard
        </Paragraph>
        
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <Search
            placeholder="Ask anything..."
            enterButton={
              <Button type="primary" size="large" icon={<SearchOutlined />}>
                搜索模型
              </Button>
            }
            size="large"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            style={{
              borderRadius: '25px',
              overflow: 'hidden'
            }}
          />
        </div>

        {/* 聊天按钮 */}
        <Button
          type="primary"
          size="large"
          icon={<MessageOutlined />}
          // 修改这里的 onClick 事件
          onClick={() => {
            // 1. 硬编码一个模型对象，指定 name 为 gpt-3.5-turbo
            setSelectedModelForChat({ name: 'gpt-3.5-turbo' });
            // 2. 打开聊天窗口
            setChatVisible(true);
          }}
          style={{
            position: 'absolute',
            right: '24px',
            bottom: '24px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            fontWeight: '500'
          }}
        >
          与 AI 对话
        </Button>
      </div>

      {/* Features Section */}
      <Row gutter={[32, 32]} style={{ marginBottom: '48px' }}>
        {features.map((feature, index) => (
          <Col xs={24} md={8} key={index}>
            <Card 
              hoverable
              style={{ 
                textAlign: 'center',
                height: '100%',
                borderRadius: '8px',
                border: '1px solid #f0f0f0',
                transition: 'all 0.3s'
              }}
              bodyStyle={{ 
                padding: '32px 24px'
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                {feature.icon}
              </div>
              <Title level={4} style={{ marginBottom: '12px', color: '#262626' }}>
                {feature.title}
              </Title>
              <Paragraph type="secondary" style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                {feature.description}
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Models Section */}
      <Card 
        title={
          <span style={{ fontSize: '20px', fontWeight: '600' }}>
            🔥 热门模型
          </span>
        }
        extra={
          <Space>
            <Select 
              value={filter} 
              onChange={(v) => { setFilter(v); fetch(); }} 
              style={{ width: 120 }}
              placeholder="筛选类型"
            >
              <Select.Option value="all">全部类型</Select.Option>
              <Select.Option value="classification">分类模型</Select.Option>
              <Select.Option value="detection">检测模型</Select.Option>
            </Select>
            <Button onClick={fetch} type="primary">刷新</Button>
          </Space>
        }
        style={{
          borderRadius: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: '#999' }}>加载模型中...</div>
          </div>
        ) : (
          <List
            grid={{ 
              gutter: 16, 
              xs: 1,
              sm: 2,
              md: 3,
              lg: 3,
              xl: 4,
              xxl: 4
            }}
            dataSource={models}
            renderItem={(item) => (
              <List.Item>
                <Card 
                  title={item.name} 
                  size="small"
                  hoverable
                  actions={[
                    <Link to={`/models/${item.id}`} style={{ color: '#1890ff' }}>查看详情</Link>,
                    // 点击时，设置要聊天的模型并打开对话框
                    <Button type="link" onClick={() => {
                      setSelectedModelForChat(item);
                      setChatVisible(true);
                    }}>测试对话</Button>
                  ]}
                  style={{
                    borderRadius: '8px',
                    height: '100%'
                  }}
                >
                  <p><strong>作者:</strong> {item.owner_name || '未知'}</p>
                  <p><strong>任务类型:</strong> {item.task || '通用'}</p>
                  <p><strong>评分:</strong> ⭐⭐⭐⭐☆ (4.2)</p>
                  <p><strong>使用次数:</strong> {Math.floor(Math.random() * 1000) + 100}</p>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 聊天对话框 */}
      <ChatDialog 
        visible={chatVisible} 
        onClose={() => setChatVisible(false)} 
        // 将选中的模型传递给对话框
        model={selectedModelForChat} 
      />

      {/* Welcome Modal */}
      <Modal
        title="🎉 欢迎来到 AI Arena！"
        open={welcomeModalVisible}
        onOk={handleWelcomeOk}
        onCancel={handleWelcomeCancel}
        okText="开始探索"
        cancelText="稍后再说"
        width={600}
        maskClosable={false}
      >
        <div style={{ padding: '20px 0' }}>
          <h3 style={{ color: '#262626', marginBottom: '16px' }}>探索 AI 模型的无限可能</h3>
          <p>在这里您可以：</p>
          <ul style={{ lineHeight: '2' }}>
            <li>📚 <strong>浏览丰富的 AI 模型库</strong> - 发现各种任务的优秀模型</li>
            <li>🏆 <strong>查看模型在排行榜上的表现</strong> - 基于真实评估数据</li>
            <li>⚔️ <strong>对比不同模型的性能</strong> - 找到最适合的解决方案</li>
            <li>💬 <strong>与 AI 直接对话</strong> - 测试模型的实时表现</li>
            <li>👤 <strong>管理您自己的模型</strong> - 上传和分享您的作品</li>
          </ul>
          <p style={{ marginTop: 20, color: '#666', fontStyle: 'italic' }}>
            开始探索这个精彩的 AI 世界，发现最适合您需求的智能模型！
          </p>
        </div>
      </Modal>
    </>
  );
}