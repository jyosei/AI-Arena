import React, { useState, useEffect } from 'react'; // 确保导入 useEffect
import { Modal, Input, Button, List, Avatar, Spin } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import apiClient from '../api/apiClient'; // 1. 导入 apiClient

const { TextArea } = Input;

// 2. 接收 model 作为 prop
export default function ChatDialog({ visible, onClose, model }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  // 当对话框打开时，清空旧消息
  useEffect(() => {
    if (visible) {
      setMessages([]);
    }
  }, [visible]);

  const handleSend = async () => {
    if (!inputValue.trim() || !model) return;

    const userMessage = {
      id: Date.now(),
      content: inputValue,
      isUser: true,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setLoading(true);

    try {
      // 3. 使用 apiClient 发送请求
      const response = await apiClient.post('/models/evaluate/', {
        model_name: model.name, // 传递模型名称
        prompt: currentInput,   // 传递用户输入
      });

      const aiMessage = {
        id: Date.now() + 1,
        content: response.data.response, // 使用后端返回的真实回复
        isUser: false,
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error("API call failed:", error);
      const errorMessage = {
        id: Date.now() + 1,
        content: `请求失败: ${error.response?.data?.error || error.message}`,
        isUser: false,
        isError: true, // 可以添加一个错误标记用于特殊样式
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      // 4. 动态显示模型名称
      title={model ? `与 ${model.name} 对话` : '与 AI 对话'}
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