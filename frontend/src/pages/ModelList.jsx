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
  const [results, setResults] = useState([]); // 用于 Battle 模式
  const [messages, setMessages] = useState([]); // 用于 Direct Chat 模式
  const [leftMessages, setLeftMessages] = useState([]); // 用于 Side-by-side 左侧模型
  const [rightMessages, setRightMessages] = useState([]); // 用于 Side-by-side 右侧模型
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState(null);
  
  const leftMessagesEndRef = React.useRef(null);
  const rightMessagesEndRef = React.useRef(null);
  const messagesEndRef = React.useRef(null);
  
  useEffect(() => {
    // 切换模式时，清空所有结果
    setResults([]);
    setMessages([]);
    setLeftMessages([]);
    setRightMessages([]);
    setPrompt('');
  }, [mode]);

  // 自动滚动到底部
  useEffect(() => {
    if (mode === 'side-by-side') {
      leftMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      rightMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (mode === 'direct-chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [leftMessages, rightMessages, messages, mode]);

  const startBattle = async () => {
    if (!prompt.trim()) {
      setBattleError("请输入提示内容。");
      return;
    }

    // Direct Chat 模式
    if (mode === 'direct-chat') {
      if (!leftModel) {
        setBattleError("请在顶部选择一个模型进行对话。");
        return;
      }
      
      const userMessage = { content: prompt, isUser: true };
      setMessages(prev => [...prev, userMessage]);
      const currentInput = prompt;
      setPrompt('');
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
      return;
    }

    // Side-by-side 模式
    if (mode === 'side-by-side') {
      if (!leftModel || !rightModel) {
        setBattleError("请在顶部选择左右两个模型进行对话。");
        return;
      }

      const userMessage = { content: prompt, isUser: true };
      setLeftMessages(prev => [...prev, userMessage]);
      setRightMessages(prev => [...prev, userMessage]);
      const currentInput = prompt;
      setPrompt('');
      setBattleLoading(true);
      setBattleError(null);

      try {
        // 同时调用两个模型
        const [leftResponse, rightResponse] = await Promise.all([
          evaluateModel(leftModel, currentInput).catch(err => ({ error: err })),
          evaluateModel(rightModel, currentInput).catch(err => ({ error: err }))
        ]);

        // 处理左侧模型响应
        if (leftResponse.error) {
          const errorMessage = { 
            content: `调用模型出错: ${leftResponse.error.response?.data?.detail || leftResponse.error.message}`, 
            isUser: false,
            isError: true
          };
          setLeftMessages(prev => [...prev, errorMessage]);
        } else {
          const aiMessage = { content: leftResponse.data.response, isUser: false };
          setLeftMessages(prev => [...prev, aiMessage]);
        }

        // 处理右侧模型响应
        if (rightResponse.error) {
          const errorMessage = { 
            content: `调用模型出错: ${rightResponse.error.response?.data?.detail || rightResponse.error.message}`, 
            isUser: false,
            isError: true
          };
          setRightMessages(prev => [...prev, errorMessage]);
        } else {
          const aiMessage = { content: rightResponse.data.response, isUser: false };
          setRightMessages(prev => [...prev, aiMessage]);
        }
      } catch (error) {
        setBattleError(`发生错误: ${error.message}`);
      } finally {
        setBattleLoading(false);
      }
      return;
    }

    // Battle 模式 (保持原有逻辑)
    let modelA = leftModel;
    let modelB = rightModel;
    // ... (其他Battle逻辑)
  };

  // ... (handleVote 逻辑保持不变)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 内容区域：根据模式和状态条件渲染 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* 欢迎消息 - Battle模式 */}
        {mode === 'battle' && results.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Welcome to Battle Mode</Title>
          </div>
        )}

        {/* 欢迎消息 - Side-by-side模式 */}
        {mode === 'side-by-side' && leftMessages.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Compare {leftModel || 'Model A'} vs {rightModel || 'Model B'}</Title>
          </div>
        )}
        
        {/* 欢迎消息 - Direct Chat模式 */}
        {mode === 'direct-chat' && messages.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Start chatting with {leftModel || 'a model'}</Title>
          </div>
        )}

        {/* Battle 模式的结果展示 */}
        {mode === 'battle' && results.length > 0 && (
          <Row gutter={16}>{/* Battle结果 */}</Row>
        )}

        {/* Side-by-side 模式的分栏聊天展示 */}
        {mode === 'side-by-side' && leftMessages.length > 0 && (
          <Row gutter={16} style={{ height: '100%' }}>
            {/* 左侧模型 */}
            <Col span={12}>
              <div style={{ 
                borderRight: '1px solid #f0f0f0', 
                paddingRight: '16px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ 
                  marginBottom: '16px', 
                  paddingBottom: '12px', 
                  borderBottom: '2px solid #f0f0f0',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  {leftModel || 'Model A'}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {leftMessages.map((msg, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: msg.isUser ? 'flex-end' : 'flex-start', 
                      marginBottom: 12 
                    }}>
                      {!msg.isUser && (
                        <Avatar icon={<RobotOutlined />} style={{ 
                          backgroundColor: '#595959', 
                          marginRight: 8 
                        }} />
                      )}
                      <div style={{ 
                        background: msg.isUser ? '#000' : (msg.isError ? '#ffebee' : '#f5f5f5'), 
                        color: msg.isUser ? 'white' : (msg.isError ? '#c62828' : 'black'), 
                        padding: '8px 12px', 
                        borderRadius: '8px', 
                        maxWidth: '80%',
                        wordBreak: 'break-word'
                      }}>
                        {msg.content}
                      </div>
                      {msg.isUser && (
                        <Avatar icon={<UserOutlined />} style={{ 
                          backgroundColor: '#000', 
                          marginLeft: 8 
                        }} />
                      )}
                    </div>
                  ))}
                  {battleLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
                      <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />
                      <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: '8px' }}>
                        <Spin size="small" /> 思考中...
                      </div>
                    </div>
                  )}
                  <div ref={leftMessagesEndRef} />
                </div>
              </div>
            </Col>

            {/* 右侧模型 */}
            <Col span={12}>
              <div style={{ 
                paddingLeft: '16px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ 
                  marginBottom: '16px', 
                  paddingBottom: '12px', 
                  borderBottom: '2px solid #f0f0f0',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  {rightModel || 'Model B'}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {rightMessages.map((msg, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: msg.isUser ? 'flex-end' : 'flex-start', 
                      marginBottom: 12 
                    }}>
                      {!msg.isUser && (
                        <Avatar icon={<RobotOutlined />} style={{ 
                          backgroundColor: '#595959', 
                          marginRight: 8 
                        }} />
                      )}
                      <div style={{ 
                        background: msg.isUser ? '#000' : (msg.isError ? '#ffebee' : '#f5f5f5'), 
                        color: msg.isUser ? 'white' : (msg.isError ? '#c62828' : 'black'), 
                        padding: '8px 12px', 
                        borderRadius: '8px', 
                        maxWidth: '80%',
                        wordBreak: 'break-word'
                      }}>
                        {msg.content}
                      </div>
                      {msg.isUser && (
                        <Avatar icon={<UserOutlined />} style={{ 
                          backgroundColor: '#000', 
                          marginLeft: 8 
                        }} />
                      )}
                    </div>
                  ))}
                  {battleLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
                      <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />
                      <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: '8px' }}>
                        <Spin size="small" /> 思考中...
                      </div>
                    </div>
                  )}
                  <div ref={rightMessagesEndRef} />
                </div>
              </div>
            </Col>
          </Row>
        )}

        {/* Direct Chat 的聊天记录展示 */}
        {mode === 'direct-chat' && messages.map((msg, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <Avatar icon={msg.isUser ? <UserOutlined /> : <RobotOutlined />} style={{ order: msg.isUser ? 2 : 1, marginLeft: msg.isUser ? 8 : 0, marginRight: msg.isUser ? 0 : 8, backgroundColor: msg.isUser ? '#000' : '#595959' }} />
            <div style={{ background: msg.isUser ? '#000' : '#f5f5f5', color: msg.isUser ? 'white' : 'black', padding: '8px 12px', borderRadius: '8px', maxWidth: '70%' }}>
              {msg.content}
            </div>
          </div>
        ))}
        {mode === 'direct-chat' && <div ref={messagesEndRef} />}

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