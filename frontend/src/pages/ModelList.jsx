import React, { useEffect, useState } from 'react';
import { 
  Input, Button, Spin, Typography, Row, Col, 
  Space, Avatar, Alert, message 
} from 'antd'; // 移除了 Modal
import { RobotOutlined, UserOutlined, SendOutlined, LikeOutlined, DislikeOutlined, SwapOutlined, MehOutlined, TableOutlined, ThunderboltOutlined, MessageOutlined } from '@ant-design/icons';
import {
  ArrowUp
}from 'lucide-react'
import { useMode } from '../contexts/ModeContext';
import { recordVote } from '../api/models';
import { useChat } from '../contexts/ChatContext';
import {evaluateModel } from '../api/models';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';

// 与 ChatDialog 一致:将 \(...\)/\[...\] 转为 $...$/$$.$$,保持代码块原样
function normalizeTexDelimiters(text) {
  if (!text) return '';
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments
    .map((seg) => {
      if (seg.startsWith('```')) return seg;
      let out = seg
        .replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => `$$\n${p1}\n$$`)
        .replace(/\\\\\[([\s\S]*?)\\\\\]/g, (m, p1) => `$$\n${p1}\n$$`);
      out = out
        .replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => `$${p1}$`)
        .replace(/\\\\\(([\s\S]*?)\\\\\)/g, (m, p1) => `$${p1}$`);
      return out;
    })
    .join('');
}

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

export default function ArenaPage() {
  const { mode, models, leftModel, rightModel, setLeftModel, setRightModel } = useMode();

  const [prompt, setPrompt] = useState('');
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

    // --- Battle 模式重构 ---
    if (mode === 'battle') {
      if (models.length < 2) {
        message.error('模型列表不足，无法开始对战。');
        return;
      }
      
      // 随机选择两个不重复的模型
      const modelIndices = new Set();
      while (modelIndices.size < 2) {
        modelIndices.add(Math.floor(Math.random() * models.length));
      }
      const [indexA, indexB] = Array.from(modelIndices);
      const modelA = models[indexA].name;
      const modelB = models[indexB].name;

      setVoted(false); // 重置投票状态
      setBattleError(null);

      const userMessage = { content: currentPrompt, isUser: true };
      setLeftMessages([userMessage]); // 开始新对战时，清空并设置用户消息
      setRightMessages([userMessage]);

      setBattleLoading(true);

      try {
        const [leftResponse, rightResponse] = await Promise.all([
            evaluateModel(modelA, currentPrompt).catch(err => ({ error: err })),
            evaluateModel(modelB, currentPrompt).catch(err => ({ error: err }))
        ]);

        // 在请求成功后，再更新外部状态，用于投票
        setLeftModel(modelA);
        setRightModel(modelB);

        // 处理左侧模型响应
        if (leftResponse.error) {
          const errorMessage = { content: `调用模型出错: ${leftResponse.error.message}`, isUser: false, isError: true };
          setLeftMessages(prev => [...prev, errorMessage]);
        } else {
          const aiMessage = { content: leftResponse.data.response, isUser: false };
          setLeftMessages(prev => [...prev, aiMessage]);
        }

        // 处理右侧模型响应
        if (rightResponse.error) {
          const errorMessage = { content: `调用模型出错: ${rightResponse.error.message}`, isUser: false, isError: true };
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
  };

  const handleVote = async (winnerChoice) => {
    // 确保我们有用于投票的 prompt
    if (!currentInput) {
      message.error("无法找到用于投票的提示。");
      return;
    }

    // --- 关键修复：确保 model_a 和 model_b 始终有值 ---
    const voteData = {
      model_a: leftModel,  // 在 battle 模式下，leftModel 和 rightModel 在请求后被设置
      model_b: rightModel, // 在 side-by-side 模式下，它们从一开始就有值
      prompt: currentInput,
      winner: winnerChoice, // winnerChoice 已经是正确的值 ('model_a', 'model_b', 'tie', 'bad', 或真实模型名)
    };

    // 增加一个日志来调试发送的数据
    console.log("Submitting vote data:", voteData);

    try {
      await recordVote(voteData);
      message.success('感谢您的投票！');
      setVoted(true);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      console.error("Vote failed:", error.response?.data || error);
      message.error(`投票失败: ${errorMsg}`);
    }
  };

  const handleDirectChatVote = async (choice) => {
    // --- 关键修复：将变量定义移到函数顶部 ---
    const lastUserMessage = messages.filter(m => m.isUser).pop();
    const lastAiMessage = messages.filter(m => !m.isUser && !m.isError).pop();

    // 现在，检查逻辑可以正常工作
    if (!lastUserMessage || !lastAiMessage) {
      message.error("无法找到用于投票的对话。");
      return;
    }

    const voteData = {
      model_a: leftModel,
      model_b: null,
      prompt: lastUserMessage.content, // <-- 现在 lastUserMessage 是有定义的
      winner: choice,
    };

    try {
      await recordVote(voteData);
      message.success('感谢您的反馈！');
      setDirectChatVoted(true);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      message.error(`提交反馈失败: ${errorMsg}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ 
        flex: 1, 
        overflowY: (mode === 'side-by-side' || mode === 'battle') ? 'hidden' : 'auto', 
        padding: '20px',
        minHeight: 0
      }}>
        {mode === 'battle' && leftMessages.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Welcome to Battle Mode</Title>
            <Paragraph style={{ color: '#999' }}>Two models will anonymously answer your prompt. You vote for the winner.</Paragraph>
          </div>
        )}

        {mode === 'side-by-side' && leftMessages.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Compare {leftModel || 'Model A'} vs {rightModel || 'Model B'}</Title>
          </div>
        )}
        
        {mode === 'direct-chat' && messages.length === 0 && !battleLoading && (
          <div style={{ textAlign: 'center', paddingTop: '20vh' }}>
            <Title level={2} style={{ color: '#ccc' }}>Start chatting with {leftModel || 'a model'}</Title>
          </div>
        )}

        {(mode === 'side-by-side' || mode === 'battle') && leftMessages.length > 0 && (
          <Row gutter={16} style={{ height: '100%' }}>
            <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #f0f0f0', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>
                {mode === 'side-by-side' ? (leftModel || 'Model A') : '模型 A'}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
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
                      wordBreak: 'break-word',
                      overflowX: 'auto'
                    }}>
                      {msg.isUser || msg.isError ? (
                        msg.content
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          linkTarget="_blank"
                          components={{
                            a: ({node, ...props}) => <a {...props} rel="noopener noreferrer" />,
                            code: ({inline, className, children, ...props}) => (
                              <code className={className} {...props}>{children}</code>
                            )
                          }}
                        >
                          {normalizeTexDelimiters(String(msg.content || ''))}
                        </ReactMarkdown>
                      )}
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
            </Col>

            <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #f0f0f0', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>
                {mode === 'side-by-side' ? (rightModel || 'Model B') : '模型 B'}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
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
                      wordBreak: 'break-word',
                      overflowX: 'auto'
                    }}>
                      {msg.isUser || msg.isError ? (
                        msg.content
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          linkTarget="_blank"
                          components={{
                            a: ({node, ...props}) => <a {...props} rel="noopener noreferrer" />,
                            code: ({inline, className, children, ...props}) => (
                              <code className={className} {...props}>{children}</code>
                            )
                          }}
                        >
                          {normalizeTexDelimiters(String(msg.content || ''))}
                        </ReactMarkdown>
                      )}
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
            </Col>
          </Row>
        )}

        {mode === 'direct-chat' && messages.map((msg, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <Avatar icon={msg.isUser ? <UserOutlined /> : <RobotOutlined />} style={{ order: msg.isUser ? 2 : 1, marginLeft: msg.isUser ? 8 : 0, marginRight: msg.isUser ? 0 : 8, backgroundColor: msg.isUser ? '#000' : '#595959' }} />
            <div style={{ background: msg.isUser ? '#000' : '#f5f5f5', color: msg.isUser ? 'white' : 'black', padding: '8px 12px', borderRadius: '8px', maxWidth: '70%', overflowX: 'auto' }}>
              {msg.isUser ? (
                msg.content
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  linkTarget="_blank"
                  components={{
                    a: ({node, ...props}) => <a {...props} rel="noopener noreferrer" />,
                    code: ({inline, className, children, ...props}) => (
                      <code className={className} {...props}>{children}</code>
                    )
                  }}
                >
                  {normalizeTexDelimiters(String(msg.content || ''))}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {mode === 'direct-chat' && <div ref={messagesEndRef} />}

        {battleLoading && messages.length === 0 && leftMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" tip="模型正在生成回应..." />
          </div>
        )}
      </div>

      {/* Side-by-side 和 Battle 模式下的投票按钮 */}
      {(mode === 'side-by-side' || mode === 'battle') && leftMessages.length > 0 && !battleLoading && (
        <div style={{ padding: '0 20px 12px 20px', textAlign: 'center', flexShrink: 0 }}>
          <Title level={4}>哪个模型的回答更好？</Title>
          <Space size="large">
            {/* --- 关键修复：根据模式传递不同的值 --- */}
            <Button 
              onClick={() => handleVote(mode === 'battle' ? 'model_a' : leftModel)} 
              disabled={voted}
            >
              ← 左边更好
            </Button>
            <Button onClick={() => handleVote('tie')} disabled={voted}>不分上下</Button>
            <Button onClick={() => handleVote('bad')} disabled={voted}>都很差</Button>
            <Button 
              onClick={() => handleVote(mode === 'battle' ? 'model_b' : rightModel)} 
              disabled={voted}
            >
              → 右边更好
            </Button>
          </Space>
        </div>
      )}

      {mode === 'direct-chat' && messages.some(m => !m.isUser && !m.isError) && (
        <div style={{ padding: '0 20px 12px 20px', textAlign: 'center', flexShrink: 0 }}>
          <Space size="large">
            <Button onClick={() => handleDirectChatVote('good')} disabled={directChatVoted}>👍 Good</Button>
            <Button onClick={() => handleDirectChatVote('bad')} disabled={directChatVoted}>👎 Bad</Button>
          </Space>
        </div>
      )}

      <div style={{ padding: '0 20px 20px 20px', flexShrink: 0 }}>
        {battleError && <Alert message={battleError} type="error" closable onClose={() => setBattleError(null)} style={{ marginBottom: 16 }} />}
        
        <div style={{ 
          position: 'relative',
          border: '1px solid #e0e0e0',
          borderRadius: '18px',
          padding: '8px 12px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center'
        }}>
          <TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything..."
            style={{ 
              paddingRight: '50px',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              resize: 'none',
              width: '100%'
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
          />
        </div>
      </div>
    </div>
  );
}