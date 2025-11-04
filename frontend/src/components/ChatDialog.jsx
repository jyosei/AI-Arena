import React, { useState } from 'react';
import { Modal, Input, Button, List, Avatar, Spin } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';

const { TextArea } = Input;

export default function ChatDialog({ visible, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      content: inputValue,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    // 模拟 AI 回复（实际使用时需要连接后端 API）
    setTimeout(() => {
      const aiMessage = {
        id: Date.now() + 1,
        content: `这是对"${inputValue}"的模拟回复。在实际应用中，这里会调用真实的 AI 模型 API。`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setLoading(false);
    }, 1000);
  };

  return (
    <Modal
      title="💬 与 AI 对话"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      style={{ top: 20 }}
    >
      <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        {/* 消息列表 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', border: '1px solid #d9d9d9', borderRadius: '8px', padding: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: '100px' }}>
              <RobotOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <p>欢迎与 AI 对话！请问我任何问题</p>
            </div>
          ) : (
            <List
              dataSource={messages}
              renderItem={message => (
                <List.Item style={{ border: 'none', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', flexDirection: message.isUser ? 'row-reverse' : 'row' }}>
                    <Avatar 
                      icon={message.isUser ? <UserOutlined /> : <RobotOutlined />}
                      style={{ 
                        backgroundColor: message.isUser ? '#1890ff' : '#52c41a',
                        margin: message.isUser ? '0 0 0 12px' : '0 12px 0 0'
                      }}
                    />
                    <div style={{ 
                      background: message.isUser ? '#1890ff' : '#f5f5f5',
                      color: message.isUser ? 'white' : 'black',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      maxWidth: '70%'
                    }}>
                      {message.content}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', margin: '8px 0' }}>
              <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a', marginRight: '12px' }} />
              <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: '12px' }}>
                <Spin size="small" /> AI 正在思考...
              </div>
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入您的问题..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (e.shiftKey) {
                return; // 允许换行
              }
              e.preventDefault();
              handleSend();
            }}
          />
          <Button 
            type="primary" 
            icon={<SendOutlined />} 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </div>
      </div>
    </Modal>
  );
}