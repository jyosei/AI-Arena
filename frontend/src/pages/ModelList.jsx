import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Input, Button, Typography, message, Tooltip } from 'antd';
import { Plus, Image as ImageIcon, X } from 'lucide-react';
import { useMode } from '../contexts/ModeContext';
import { useChat } from '../contexts/ChatContext';
import { useNavigate } from 'react-router-dom';
import request from '../api/request';

const { Title, Paragraph } = Typography;

export default function ArenaPage() {
  // --- 1. 从 Context 和 Hooks 获取必要的状态和函数 ---
  const { mode, leftModel, rightModel, setLeftModel, setRightModel } = useMode();
  const { addChat } = useChat();
  const navigate = useNavigate();

  // --- 2. 定义组件内部状态 ---
  const [allModels, setAllModels] = useState([]); // 存储从后端获取的所有模型
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false); // 新增：跟踪是否处于生成图片模式
  const imageInputRef = useRef(null);

  // --- 3. 从后端获取模型列表 ---
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await request.get('/models/'); // 调用您的 API
        setAllModels(response.data);
      } catch (error) {
        console.error('Failed to fetch models:', error);
        message.error('加载模型列表失败');
      }
    };
    fetchModels();
  }, []);

  // --- 4. 核心逻辑：根据当前状态动态计算可用模型 ---
  const availableModels = useMemo(() => {
    if (uploadedImage) {
      // 如果上传了图片，只显示有 vision 能力的模型
      return allModels.filter(m => m.capabilities.includes('vision'));
    }
    if (isGeneratingImage) {
      // 如果要生成图片，只显示有 image_generation 能力的模型
      return allModels.filter(m => m.capabilities.includes('image_generation'));
    }
    // 默认显示所有模型
    return allModels;
  }, [allModels, uploadedImage, isGeneratingImage]);

  // --- 5. 核心逻辑：根据选择的模型动态计算按钮可用性 (仿照 Chat.jsx) ---
  const leftModelObject = useMemo(() => allModels.find(m => m.name === leftModel), [allModels, leftModel]);
  const rightModelObject = useMemo(() => allModels.find(m => m.name === rightModel), [allModels, rightModel]);

  const canUploadImage = useMemo(() => {
    if (isGeneratingImage) return false;

    if (mode === 'direct-chat') {
      return !leftModelObject || (leftModelObject.capabilities?.includes('vision') ?? false);
    }
    if (mode === 'side-by-side' || mode === 'battle') {
      const leftOk = leftModelObject?.capabilities?.includes('vision') ?? false;
      const rightOk = rightModelObject?.capabilities?.includes('vision') ?? false;
      if (!leftModelObject && !rightModelObject) return true;
      if (leftModelObject && !rightModelObject) return leftOk;
      if (!leftModelObject && rightModelObject) return rightOk;
      return leftOk && rightOk;
    }
    return false;
  }, [mode, leftModelObject, rightModelObject, isGeneratingImage]);

  const canGenerateImage = useMemo(() => {
    if (uploadedImage) return false;
    if (mode !== 'direct-chat') return false;
    return !leftModelObject || (leftModelObject.capabilities?.includes('image_generation') ?? false);
  }, [mode, leftModelObject, uploadedImage]);

  // --- 6. 事件处理函数 ---
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedImage(file);
      setIsGeneratingImage(false); // 与生成图片互斥
    }
    event.target.value = null;
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
  };

  const handleToggleGenerateImage = () => {
    setIsGeneratingImage(prev => !prev);
    if (!isGeneratingImage) {
      setUploadedImage(null);
    }
  };

  const startBattle = async () => {
    // 1. 输入校验
    if (!prompt.trim() && !uploadedImage && !isGeneratingImage) {
      message.warning('请输入您的问题或上传图片');
      return;
    }
    if (mode !== 'direct-chat' && (!leftModel || !rightModel)) {
      message.warning('请选择两个模型进行比较');
      return;
    }
    if (mode === 'direct-chat' && !leftModel) {
      message.warning('请选择一个模型进行对话');
      return;
    }

    const currentPrompt = prompt.trim();

    try {
      // 2. 准备创建会话所需的数据 (仿照您的范例)
      const modelNameForConv = mode === 'direct-chat' ? leftModel 
                             : mode === 'side-by-side' ? `${leftModel} vs ${rightModel}`
                             : 'Battle'; // Battle 模式下模型名是匿名的
      const title = currentPrompt.substring(0, 50) || "新会话";

      // 3. 调用 addChat 创建新会话，并获取其 ID
      // 假设 addChat 函数会返回新创建的 chat 的 ID
      const newChatId = await addChat(title, modelNameForConv, mode);

      if (newChatId) {
        // 4. 准备要传递给聊天页的初始状态
        const navigationState = {
          initialPrompt: currentPrompt,
          initialImage: uploadedImage,
          isGeneratingImage: isGeneratingImage,
          // 将模型选择也传递过去，以便聊天页正确设置
          mode: mode,
          leftModel: leftModel,
          rightModel: rightModel,
        };

        // 5. 清空当前页面的输入
        setPrompt('');
        setUploadedImage(null);
        setIsGeneratingImage(false);

        // 6. 跳转到聊天页面，并通过 state 传递数据
        navigate(`/chat/${newChatId}`, { state: navigationState });
      } else {
        // 如果 addChat 没有返回 ID，说明创建失败
        throw new Error('addChat did not return a new chat ID.');
      }
    } catch (error) {
      console.error('Failed to create or navigate to chat:', error);
      message.error('创建会话失败，请稍后重试');
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
            placeholder={isGeneratingImage ? "输入详细的图片描述..." : "输入您的问题..."}
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
            <Tooltip title={canUploadImage ? "上传图片" : "当前模型不支持图片上传"}>
              <Button 
                style={iconButtonStyle} 
                icon={<Plus size={20} />} 
                onClick={() => imageInputRef.current.click()}
                disabled={isGeneratingImage || !canUploadImage} // 禁用按钮
              />
            </Tooltip>
            <Tooltip title={canGenerateImage ? "生成图片" : "当前模型不支持图片生成"}>
              <Button 
                style={iconButtonStyle} 
                icon={<ImageIcon size={20} />}
                onClick={handleToggleGenerateImage}
                type={isGeneratingImage ? 'primary' : 'default'} // 选中时高亮
                disabled={!!uploadedImage || !canGenerateImage} // 禁用按钮
              />
            </Tooltip>
            <div style={{ flex: 1 }} />
            <Button type="primary" onClick={startBattle}>开始</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
