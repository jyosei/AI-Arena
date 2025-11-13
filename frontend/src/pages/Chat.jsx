import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { List, Avatar, Input, Button, Spin, message as antdMessage } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import apiClient from '../api/apiClient';
import request from '../api/request';
import { useChat } from '../contexts/ChatContext';
import { useMode } from '../contexts/ModeContext';
import AuthContext from '../contexts/AuthContext';

const { TextArea } = Input;

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { chatHistory } = useChat();
  const { models, leftModel } = useMode();
  const { user } = React.useContext(AuthContext);

  const conv = chatHistory.find(c => String(c.id) === String(id));
  const title = conv ? conv.title : '会话';

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 选择模型：优先使用对话保存的模型，然后使用 ModeContext 的 leftModel，最后回退到第一个 models
  const savedModelName = conv?.model_name;
  const modelName = savedModelName || leftModel || (models && models.length > 0 ? models[0].name : null);
  const model = models.find(m => m.name === modelName) || (models[0] || null);

  useEffect(() => {
    // 加载会话的历史消息（如果用户已登录且会话存在）
    const loadMessages = async () => {
      if (!user || !id) {
        setLoadingHistory(false);
        setMessages([]);
        return;
      }

      try {
        const res = await request.get(`models/chat/conversation/${id}/messages/`);
        const adapted = res.data.map(msg => ({
          id: msg.id,
          content: msg.content,
          isUser: msg.is_user,
          created_at: msg.created_at
        }));
        setMessages(adapted);
      } catch (err) {
        console.error('Failed to load messages:', err);
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    setLoadingHistory(true);
    loadMessages();
  }, [id, user]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (!model) {
      antdMessage.error('请先在顶部选择一个模型');
      return;
    }

    const userMessage = { id: Date.now(), content: inputValue, isUser: true };
    setMessages(prev => [...prev, userMessage]);
    const prompt = inputValue;
    setInputValue('');
    setLoading(true);

    // 如果用户已登录，保存用户消息到后端
    if (user && id) {
      try {
        await request.post('models/chat/message/', {
          conversation_id: id,
          content: prompt,
          is_user: true
        });
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }

    try {
      const res = await apiClient.post('/models/evaluate/', { model_name: model.name, prompt, conversation_id: id });
      const aiMessage = { id: Date.now() + 1, content: res.data.response, isUser: false };
      setMessages(prev => [...prev, aiMessage]);

      // 如果用户已登录，保存AI回复到后端
      if (user && id) {
        try {
          await request.post('models/chat/message/', {
            conversation_id: id,
            content: res.data.response,
            is_user: false
          });
        } catch (err) {
          console.error('Failed to save AI message:', err);
        }
      }
    } catch (err) {
      console.error('Evaluate failed:', err);
      const errMsg = { id: Date.now() + 1, content: `请求失败: ${err.response?.data?.error || err.message}`, isUser: false, isError: true };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ color: '#8c8c8c', marginTop: 4 }}>模型: {model ? model.name : '未选择'}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
        {loadingHistory ? (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Spin /> 加载历史消息...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
            <RobotOutlined style={{ fontSize: 36, marginBottom: 12 }} />
            <div>请输入问题开始对话</div>
          </div>
        ) : (
          <List
            dataSource={messages}
            renderItem={message => (
              <List.Item style={{ border: 'none', padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', flexDirection: message.isUser ? 'row-reverse' : 'row' }}>
                  <Avatar icon={message.isUser ? <UserOutlined /> : <RobotOutlined />} style={{ backgroundColor: message.isUser ? '#000' : '#595959', margin: message.isUser ? '0 0 0 12px' : '0 12px 0 0' }} />
                  <div style={{ background: message.isUser ? '#000' : '#f5f5f5', color: message.isUser ? '#fff' : '#000', padding: '8px 12px', borderRadius: 12, maxWidth: '70%' }}>
                    {message.content}
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 8 }}>
            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 12 }} />
            <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 12 }}>
              <Spin size="small" /> AI 正在思考...
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <TextArea value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="输入您的问题..." autoSize={{ minRows: 1, maxRows: 4 }} onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }} />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!inputValue.trim()}>发送</Button>
      </div>
    </div>
  );
}
