import React, { useEffect, useState } from 'react';
import { 
  Input, Button, Spin, Typography, Row, Col, 
  Space, Avatar, Alert, message 
} from 'antd'; // 移除了 Modal
import { RobotOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import {
  ArrowUp
}from 'lucide-react'
import { useMode } from '../contexts/ModeContext';
// 确保导入了 battleModels 和 evaluateModel
import { battleModels, evaluateModel, recordVote } from '../api/models'; 

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

// --- 核心修改 1：移除整个 ChatDialog 组件 ---
// function ChatDialog({ ... }) { ... } // (REMOVE)

export default function ArenaPage() {
  const { mode, models, leftModel, rightModel, setLeftModel, setRightModel } = useMode();

  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState([]); // 用于 Battle 和 Side-by-side
  const [messages, setMessages] = useState([]); // --- 核心修改 2：为聊天模式添加 messages 状态 ---
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState(null);
  
  // ... (voted, isAnonymous state)
  // --- 核心修改 3：移除与 ChatDialog 相关的 state ---
  // const [chatVisible, setChatVisible] = useState(false); // (REMOVE)
  // const [selectedModelForChat, setSelectedModelForChat] = useState(null); // (REMOVE)

  useEffect(() => {
    // 切换模式时，清空所有结果
    setResults([]);
    setMessages([]);
    setPrompt('');
  }, [mode]);

  const startBattle = async () => {
    if (!prompt.trim()) {
      setBattleError("请输入提示内容。");
      return;
    }

    // --- 核心修改 4：重写 direct-chat 逻辑 ---
    if (mode === 'direct-chat') {
      if (!leftModel) {
        setBattleError("请在顶部选择一个模型进行对话。");
        return;
      }
      
      const userMessage = { content: prompt, isUser: true };
      setMessages(prev => [...prev, userMessage]);
      const currentInput = prompt;
      setPrompt(''); // 清空输入框
      setBattleLoading(true);
      setBattleError(null);

      try {
        const response = await evaluateModel(leftModel, currentInput);
        const aiMessage = { content: response.data.response, isUser: false };
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        const errorMessage = { content: `调用模型出错: ${error.response?.data?.detail || error.message}`, isUser: false };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setBattleLoading(false);
      }
      return; // 结束函数，不执行下面的对战逻辑
    }

    // --- Battle 和 Side-by-side 逻辑 (保持不变) ---
    let modelA = leftModel;
    let modelB = rightModel;
    // ... (随机选择模型的逻辑)
    // ... (API 调用逻辑)
  };

  // ... (handleVote 逻辑保持不变)

  return (
    // --- 核心修改 5：重构整个返回的 JSX ---
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* --- 内容区域：根据模式和状态条件渲染 --- */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {mode !== 'direct-chat' && results.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Welcome back</Title>
          </div>
        )}
        
        {mode === 'direct-chat' && messages.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Start chatting with {leftModel || 'a model'}</Title>
          </div>
        )}

        {/* Battle 和 Side-by-side 的结果展示 */}
        {mode !== 'direct-chat' && results.length > 0 && (
          <Row gutter={16}>{/* ... 你的结果 Card ... */}</Row>
        )}

        {/* Direct Chat 的聊天记录展示 */}
        {mode === 'direct-chat' && messages.map((msg, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <Avatar icon={msg.isUser ? <UserOutlined /> : <RobotOutlined />} style={{ order: msg.isUser ? 2 : 1, marginLeft: msg.isUser ? 8 : 0, marginRight: msg.isUser ? 0 : 8 }} />
            <div style={{ background: msg.isUser ? '#1890ff' : '#f5f5f5', color: msg.isUser ? 'white' : 'black', padding: '8px 12px', borderRadius: '8px', maxWidth: '70%' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* 全局加载动画 */}
        {battleLoading && (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" tip="模型正在生成回应..." />
          </div>
        )}
      </div>

      {/* --- 输入框区域：始终在底部 --- */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        {battleError && <Alert message={battleError} type="error" closable onClose={() => setBattleError(null)} style={{ marginBottom: 16 }} />}
        
        {/* --- 核心修改 1：为容器 div 添加样式 --- */}
        <div style={{ 
          position: 'relative',
          border: '1px solid #e0e0e0', // 添加一个浅灰色边框
          borderRadius: '18px',         // 设置圆角
          padding: '8px 12px',          // 添加内边距，给输入框留出空间
          background: '#fff',           // 确保背景是白色
          display: 'flex',              // 使用 Flexbox 布局
          alignItems: 'center'          // 垂直居中对齐
        }}>
          <TextArea
            // --- 核心修改 3：使用 autoSize 替代 rows ---
            autoSize={{ minRows: 3, maxRows: 6 }} // 最小1行，最多6行
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything..."
            // --- 核心修改 2：“透明化”输入框 ---
            style={{ 
              paddingRight: '50px',
              background: 'transparent', // 透明背景
              border: 'none',            // 移除边框
              boxShadow: 'none',         // 移除 Antd 默认的蓝色 focus 辉光
              resize: 'none',            // 禁止用户手动调整大小
              width: '100%'              // 确保它填满 flex 容器
            }}
            onPressEnter={e => !e.shiftKey && (e.preventDefault(), startBattle())}
          />
          <Button 
            type="primary"
            className="custom-send-button"
            icon={<ArrowUp />}
            size="large"
            onClick={startBattle}
            loading={battleLoading}
            disabled={!prompt.trim()}
            // 按钮的位置现在由 Flexbox 和 margin 控制，而不是绝对定位
            // style={{ position: 'absolute', right: '10px', bottom: '10px' }} // (REMOVE)
          />
        </div>
      </div>
    </div>
  );
}