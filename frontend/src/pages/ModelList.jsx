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
  const [currentInput, setCurrentInput] = useState(''); // <-- 添加这个 state
    // 用于维护对话的 conversation ID
    const [directChatConvId, setDirectChatConvId] = useState(null); // Direct Chat 的 conversation ID
    const [leftConvId, setLeftConvId] = useState(null); // Side-by-side 左侧的 conversation ID
    const [rightConvId, setRightConvId] = useState(null); // Side-by-side 右侧的 conversation ID
    const [voted, setVoted] = useState(false); // 用于 Side-by-side 模式
    const [directChatVoted, setDirectChatVoted] = useState(false); // 用于 Direct Chat 模式

  const messagesEndRef = React.useRef(null);
  
  useEffect(() => {
      // 切换模式时,清空所有结果和 conversation ID
    setResults([]);
    setMessages([]);
    setLeftMessages([]);
    setRightMessages([]);
    setPrompt('');
      setDirectChatConvId(null);
      setLeftConvId(null);
      setRightConvId(null);
  }, [mode]);

  // 自动滚动到底部
  useEffect(() => {
    if (mode === 'direct-chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, mode]);

  const startBattle = async () => {
    if (!prompt.trim()) {
      return;
    }

    const currentPrompt = prompt; // 将当前 prompt 保存到局部变量中
    setCurrentInput(currentPrompt); // <-- 保存当前输入
    setPrompt(''); // 立即清空输入框

    // Direct Chat 模式
    if (mode === 'direct-chat') {
      setDirectChatVoted(false);
      const userMessage = { content: currentPrompt, isUser: true };
      setMessages(prev => [...prev, userMessage]);
      setBattleLoading(true);

      try {
        const response = await evaluateModel(leftModel, currentPrompt, directChatConvId);
        const aiMessage = { content: response.data.response, isUser: false };
        setMessages(prev => [...prev, aiMessage]);
        if (response.data.conversation_id && !directChatConvId) {
          setDirectChatConvId(response.data.conversation_id);
        }
      } catch (error) {
        const errorMessage = { 
          content: `调用模型出错: ${error.response?.data?.detail || error.message}`, 
          isUser: false,
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setBattleLoading(false);
      }
      return;
    }

    // Side-by-side 模式
    if (mode === 'side-by-side') {
      if (!leftModel || !rightModel) {
        message.error('请在侧边栏选择两个模型进行比较。');
        return;
      }
      
      setVoted(false); // 重置投票状态

      // --- 关键修复：将用户消息添加到左右两边的状态中 ---
      const userMessage = { content: currentPrompt, isUser: true };
      setLeftMessages(prev => [...prev, userMessage]);
      setRightMessages(prev => [...prev, userMessage]);
      
      setBattleLoading(true);
      setBattleError(null);

      try {
        // 2. 直接使用局部变量 currentPrompt 进行 API 调用
        const [leftResponse, rightResponse] = await Promise.all([
            evaluateModel(leftModel, currentPrompt, leftConvId).catch(err => ({ error: err })),
            evaluateModel(rightModel, currentPrompt, rightConvId).catch(err => ({ error: err }))
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
          if (leftResponse.data.conversation_id && !leftConvId) {
            setLeftConvId(leftResponse.data.conversation_id);
          }
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
          if (rightResponse.data.conversation_id && !rightConvId) {
            setRightConvId(rightResponse.data.conversation_id);
          }
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

  // --- 新增：投票处理函数 ---
  const handleVote = async (winnerChoice) => {
    // --- 关键修复：直接从 state 获取 prompt ---
    if (!currentInput) {
      message.error("无法找到用于投票的提示。");
      return;
    }

    const voteData = {
      model_a: leftModel,
      model_b: rightModel,
      prompt: currentInput, // <-- 使用保存的输入
      winner: winnerChoice, // 'model_a', 'model_b', 'tie', 'bad'
    };

    try {
      await recordVote(voteData);
      message.success('感谢您的投票！');
      setVoted(true);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      message.error(`投票失败: ${errorMsg}`);
    }
  };
  const handleDirectChatVote = async (choice) => {
    // 获取最后一条用户消息和AI消息
    const lastUserMessage = messages.filter(m => m.isUser).pop();
    const lastAiMessage = messages.filter(m => !m.isUser && !m.isError).pop();

    if (!lastUserMessage || !lastAiMessage) {
      message.error("无法找到用于投票的对话。");
      return;
    }

    const voteData = {
      model_a: leftModel, // 在 Direct Chat 中，我们只关心一个模型
      model_b: null,      // 第二个模型可以为 null
      prompt: lastUserMessage.content,
      winner: choice, // 'good' or 'bad'
    };

    try {
      await recordVote(voteData);
      message.success('感谢您的反馈！');
      setDirectChatVoted(true); // 投票成功后禁用按钮
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      message.error(`提交反馈失败: ${errorMsg}`);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 内容区域:根据模式和状态条件渲染 */}
      <div style={{ 
        flex: 1, 
        overflowY: mode === 'side-by-side' ? 'hidden' : 'auto', 
        padding: '20px',
        minHeight: 0
      }}>
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
          <>
            <Row gutter={16} style={{ height: '100%' }}>
              {/* 左侧模型 Col */}
              <Col span={12} style={{ height: '100%' }}>
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
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    {leftModel || 'Model A'}
                  </div>
                  <div style={{ 
                    flex: 1,
                    overflowY: 'auto',
                    paddingRight: '8px'
                  }}>
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
                  </div>
                </div>
              </Col>

              {/* 右侧模型 */}
              <Col span={12} style={{ height: '100%' }}>
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
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    {rightModel || 'Model B'}
                  </div>
                  <div style={{ 
                    flex: 1,
                    overflowY: 'auto',
                    paddingRight: '8px'
                  }}>
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
                  </div>
                </div>
              </Col>
            </Row>

            {/* --- 新增：Side-by-side 模式下的投票按钮 --- */}
            <div style={{ textAlign: 'center', marginTop: '24px', flexShrink: 0 }}>
              <Title level={4}>哪个模型的回答更好？</Title>
              <Space size="large">
                <Button onClick={() => handleVote('model_a')}>← 左边更好</Button>
                <Button onClick={() => handleVote('tie')}>不分上下</Button>
                <Button onClick={() => handleVote('bad')}>都很差</Button>
                <Button onClick={() => handleVote('model_b')}>右边更好 →</Button>
              </Space>
            </div>
          </>
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
      {mode === 'direct-chat' && messages.some(m => !m.isUser && !m.isError) && (
          <div style={{ textAlign: 'center', marginTop: '24px', paddingBottom: '12px' }}>
            <Space size="large">
              <Button onClick={() => handleDirectChatVote('good')} disabled={directChatVoted}>👍 Good</Button>
              <Button onClick={() => handleDirectChatVote('bad')} disabled={directChatVoted}>👎 Bad</Button>
            </Space>
          </div>
        )}
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