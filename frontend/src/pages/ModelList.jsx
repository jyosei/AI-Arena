import React, { useState } from 'react';
import { Input, Button, Typography, message } from 'antd';
import { ArrowUp } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';
import { useChat } from '../contexts/ChatContext';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

export default function ArenaPage() {
  const { mode, leftModel, rightModel } = useMode();
  const { addChat } = useChat();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');

  const startBattle = async () => {
    if (!prompt.trim()) {
      return;
    }

    const currentPrompt = prompt.trim();
    
    // 创建新会话并跳转到聊天页面
    try {
      const modelName = mode === 'direct-chat' ? leftModel : 
                       mode === 'side-by-side' ? `${leftModel} vs ${rightModel}` :
                       'Battle';
      const title = currentPrompt.length > 30 ? currentPrompt.substring(0, 30) + '...' : currentPrompt;
      const newChatId = await addChat(title, modelName, mode);
      
      if (newChatId) {
        // 跳转到聊天页面，并通过 state 传递初始消息
        navigate(`/chat/${newChatId}`, { 
          state: { initialPrompt: currentPrompt } 
        });
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
      message.error('创建会话失败');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 欢迎界面 */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <Title level={1} style={{ color: '#333', marginBottom: '16px' }}>
          欢迎使用 AI Arena
        </Title>
        <Paragraph style={{ fontSize: '16px', color: '#666', marginBottom: '40px', textAlign: 'center', maxWidth: '600px' }}>
          {mode === 'battle' && '两个模型将匿名回答您的问题，您可以为更好的回答投票'}
          {mode === 'side-by-side' && `比较  和  的回答`}
          {mode === 'direct-chat' && `开始与  对话`}
        </Paragraph>
      </div>

      {/* 输入框 */}
      <div style={{ padding: '0 20px 20px 20px', flexShrink: 0 }}>
        <div style={{ 
          border: '1px solid #e0e0e0',
          borderRadius: '18px',
          padding: '12px',
          background: '#fff',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 6 }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="输入任何内容开始对话..."
              style={{ 
                paddingRight: '50px',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                resize: 'none',
                width: '100%',
                fontSize: '16px'
              }}
              onPressEnter={e => !e.shiftKey && (e.preventDefault(), startBattle())}
            />
            <Button 
              type="primary"
              className="custom-send-button"
              icon={<ArrowUp />}
              size="large"
              onClick={startBattle}
              disabled={!prompt.trim()}
              style={{
                position: 'absolute',
                right: '8px',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
