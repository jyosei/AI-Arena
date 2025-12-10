import React, { useState, useRef } from 'react';
import { Input, Button, Typography, message, Tooltip } from 'antd';
// --- 关键修改 1: 导入新的、更匹配的图标 ---
import { Plus, Globe, Image as ImageIcon, Code, X } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';
import { useChat } from '../contexts/ChatContext';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

export default function ArenaPage() {
  const { mode, leftModel, rightModel } = useMode();
  const { addChat } = useChat();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const imageInputRef = useRef(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedImage(file);
    }
    event.target.value = null;
  };

  // --- 关键修改 2: 添加一个移除图片的函数 ---
  const handleRemoveImage = () => {
    setUploadedImage(null);
  };

  const startBattle = async () => {
    if (!prompt.trim() && !uploadedImage) {
      return;
    }

    const currentPrompt = prompt.trim();
    
    try {
      const modelName = mode === 'direct-chat' ? leftModel : 
                       mode === 'side-by-side' ? `${leftModel} vs ${rightModel}` :
                       'Battle';
      const title = currentPrompt.length > 30 ? currentPrompt.substring(0, 30) + '...' : (currentPrompt || "新会话");
      
      const newChatId = await addChat(title, modelName, mode);
      
      if (newChatId) {
        // 跳转到聊天页面，并通过 state 传递初始消息和图片
        // 注意：直接传递 File 对象可能不是最佳实践，但对于简单场景可行
        navigate(`/chat/${newChatId}`, { 
          state: { 
            initialPrompt: currentPrompt,
            initialImage: uploadedImage, // 将图片文件也传递过去
          } 
        });
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
      message.error('创建会话失败');
    }
  };

  // --- 关键修改 3: 定义统一的按钮样式 ---
  const iconButtonStyle = {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#e0e0e0',
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 欢迎界面 */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <Title level={1} style={{ color: 'var(--text)', marginBottom: '16px' }}>
          欢迎使用 AI Arena
        </Title>
        <Paragraph style={{ fontSize: '16px', color: 'var(--muted)', marginBottom: '40px', textAlign: 'center', maxWidth: '680px' }}>
          {mode === 'battle' && '两个模型将匿名回答您的问题，您可以为更好的回答投票'}
          {mode === 'side-by-side' && `比较 ${leftModel || '模型A'} 和 ${rightModel || '模型B'} 的回答`}
          {mode === 'direct-chat' && `开始与 ${leftModel || '一个模型'} 对话`}
        </Paragraph>
      </div>

      {/* --- 关键修改 3: 采用图片中的全新布局和样式 --- */}
      <div style={{ padding: '0 20px 20px 20px', flexShrink: 0 }}>
        <div style={{ 
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px',
          background: 'var(--panel)',
          boxShadow: 'var(--shadow-sm)',
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column', // 垂直布局
          gap: '12px' // 文本框和按钮行的间距
        }}>
          {/* --- 关键修改 4: 添加图片预览区域 --- */}
          {uploadedImage && (
            <div style={{ position: 'relative', maxWidth: '120px', margin: '0 8px' }}>
              <img
                src={URL.createObjectURL(uploadedImage)}
                alt="Preview"
                style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-md)' }}
              />
              <Button
                shape="circle"
                icon={<X size={14} />}
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: 'var(--muted)',
                  color: 'var(--background)',
                  border: 'none',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            </div>
          )}

          {/* 文本输入框 */}
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 6 }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入您的问题..."
            style={{ 
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              resize: 'none',
              width: '100%',
              fontSize: '16px',
              padding: '8px'
            }}
            onPressEnter={e => !e.shiftKey && (e.preventDefault(), startBattle())}
          />

          {/* 隐藏的文件输入 */}
          <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />

          {/* 功能按钮行 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Tooltip title="上传文件">
              <Button style={iconButtonStyle} icon={<Plus size={20} />} />
            </Tooltip>
            <Tooltip title="搜索网络">
              <Button style={iconButtonStyle} icon={<Globe size={20} />} />
            </Tooltip>
            <Tooltip title="上传图片">
              <Button 
                style={iconButtonStyle} 
                icon={<ImageIcon size={20} />} 
                onClick={() => imageInputRef.current.click()}
              />
            </Tooltip>
            <Tooltip title="代码片段">
              <Button style={iconButtonStyle} icon={<Code size={20} />} />
            </Tooltip>
            <div style={{ flex: 1 }} />
            <Button type="primary" onClick={startBattle}>开始</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
