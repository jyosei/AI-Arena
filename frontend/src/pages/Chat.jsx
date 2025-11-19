import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { List, Avatar, Input, Button, Spin, message as antdMessage, Typography, Row, Col, Space, Alert } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { ArrowUp } from 'lucide-react';
import apiClient from '../api/apiClient';
import request from '../api/request';
import { useChat } from '../contexts/ChatContext';
import { useMode } from '../contexts/ModeContext';
import AuthContext from '../contexts/AuthContext';
import { evaluateModel, recordVote } from '../api/models';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';

// 与 ChatDialog 一致：将 \(...\)/\[...\] 转为 $...$/$$..$$ ，保持代码块原样
function normalizeTexDelimiters(text) {
  if (!text) return '';
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments
    .map((seg) => {
      if (seg.startsWith('```')) return seg;
      // 先处理块级公式 \[ ... \]
      let out = seg.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => `$$${p1}$$`);
      // 再处理行内公式 \( ... \)
      out = out.replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => `$${p1}$`);
      return out;
    })
    .join('');
}

const { TextArea } = Input;
const { Title } = Typography;

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { chatHistory } = useChat();
  const { mode, setMode, models, leftModel, rightModel, setLeftModel, setRightModel } = useMode();
  const { user } = React.useContext(AuthContext);

  const conv = chatHistory.find(c => String(c.id) === String(id));
  const title = conv ? conv.title : '会话';
  const savedMode = conv?.mode || 'direct-chat';

  // 从 location.state 获取初始消息
  const initialPrompt = location.state?.initialPrompt;

  // 当进入聊天页面时，恢复保存的模式和模型选择
  React.useEffect(() => {
    if (savedMode && savedMode !== mode) {
      setMode(savedMode);
    }
    
    // 恢复模型选择
    if (conv?.model_name) {
      if ((savedMode === 'side-by-side' || savedMode === 'battle') && conv.model_name.includes(' vs ')) {
        // Side-by-side 和 Battle 模式：解析 "modelA vs modelB"
        const [left, right] = conv.model_name.split(' vs ').map(s => s.trim());
        if (left) setLeftModel(left);
        if (right) setRightModel(right);
      } else if (savedMode === 'direct-chat') {
        // Direct Chat 模式：只设置左侧模型
        setLeftModel(conv.model_name);
      }
    }
  }, [id, savedMode, conv?.model_name, mode, setMode, setLeftModel, setRightModel]);

  // 三种模式的消息状态
  const [messages, setMessages] = useState([]); // Direct Chat 模式
  const [leftMessages, setLeftMessages] = useState([]); // Side-by-side/Battle 左侧
  const [rightMessages, setRightMessages] = useState([]); // Side-by-side/Battle 右侧
  
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [currentInput, setCurrentInput] = useState('');
  const [voted, setVoted] = useState(false);
  const [directChatVoted, setDirectChatVoted] = useState(false);
  const [battleError, setBattleError] = useState(null);

  // 选择模型：优先使用对话保存的模型，然后使用 ModeContext 的 leftModel，最后回退到第一个 models
  const savedModelName = conv?.model_name;
  const modelName = savedModelName || leftModel || (models && models.length > 0 ? models[0].name : null);
  const model = models.find(m => m.name === modelName) || (models[0] || null);

  // 注意：不要在模式切换时清空消息，因为用户可能想保留当前会话的历史

  useEffect(() => {
    // 加载会话的历史消息
    const loadMessages = async () => {
      if (!user || !id) {
        setLoadingHistory(false);
        setMessages([]);
        setLeftMessages([]);
        setRightMessages([]);
        return;
      }

      try {
        const res = await request.get(`models/chat/conversation/${id}/messages/`);
        const adapted = res.data.map(msg => ({
          id: msg.id,
          content: msg.content,
          isUser: msg.is_user,
          model_name: msg.model_name,
          created_at: msg.created_at
        }));
        
        // 根据模式分配消息
        if (savedMode === 'direct-chat') {
          setMessages(adapted);
          setLeftMessages([]);
          setRightMessages([]);
        } else if (savedMode === 'side-by-side') {
          // Side-by-side 模式：根据 model_name 分配到左右两栏
          const leftModelMessages = [];
          const rightModelMessages = [];
          
          // 从 conv.model_name 解析左右模型名称
          let leftModelName = leftModel;
          let rightModelName = rightModel;
          if (conv?.model_name && conv.model_name.includes(' vs ')) {
            [leftModelName, rightModelName] = conv.model_name.split(' vs ').map(s => s.trim());
          }
          
          let aiMessageCount = 0; // 用于旧数据的交替分配
          adapted.forEach(msg => {
            if (msg.isUser) {
              // 用户消息同时显示在两边
              leftModelMessages.push(msg);
              rightModelMessages.push(msg);
            } else {
              // AI 消息根据 model_name 分配
              if (msg.model_name === leftModelName) {
                leftModelMessages.push(msg);
              } else if (msg.model_name === rightModelName) {
                rightModelMessages.push(msg);
              } else if (!msg.model_name) {
                // 兼容旧数据：model_name 为 null 时，交替分配到左右两侧
                // 假设每轮对话是：左模型回复、右模型回复
                if (aiMessageCount % 2 === 0) {
                  leftModelMessages.push(msg);
                } else {
                  rightModelMessages.push(msg);
                }
                aiMessageCount++;
              }
            }
          });
          
          setLeftMessages(leftModelMessages);
          setRightMessages(rightModelMessages);
          setMessages([]);
        } else if (savedMode === 'battle') {
          // Battle 模式：也加载历史消息（与 side-by-side 逻辑相同）
          const leftModelMessages = [];
          const rightModelMessages = [];
          
          // 从 conv.model_name 解析左右模型名称
          let leftModelName = leftModel;
          let rightModelName = rightModel;
          if (conv?.model_name && conv.model_name.includes(' vs ')) {
            [leftModelName, rightModelName] = conv.model_name.split(' vs ').map(s => s.trim());
          }
          
          console.log('Battle mode loading:', { 
            convModelName: conv?.model_name, 
            leftModelName, 
            rightModelName,
            messageCount: adapted.length 
          });
          
          let aiMessageCount = 0;
          adapted.forEach(msg => {
            if (msg.isUser) {
              leftModelMessages.push(msg);
              rightModelMessages.push(msg);
            } else {
              console.log('Battle AI message:', { 
                model_name: msg.model_name, 
                content: msg.content.substring(0, 50),
                leftMatch: msg.model_name === leftModelName,
                rightMatch: msg.model_name === rightModelName
              });
              if (msg.model_name === leftModelName) {
                leftModelMessages.push(msg);
              } else if (msg.model_name === rightModelName) {
                rightModelMessages.push(msg);
              } else if (!msg.model_name) {
                // 兼容旧数据
                if (aiMessageCount % 2 === 0) {
                  leftModelMessages.push(msg);
                } else {
                  rightModelMessages.push(msg);
                }
                aiMessageCount++;
              }
            }
          });
          
          setLeftMessages(leftModelMessages);
          setRightMessages(rightModelMessages);
          setMessages([]);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
        setMessages([]);
        setLeftMessages([]);
        setRightMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    setLoadingHistory(true);
    loadMessages();
  }, [id, user, savedMode, leftModel, rightModel, conv?.model_name]);

  // 处理从首页传来的初始消息
  useEffect(() => {
    if (initialPrompt && !loadingHistory && !loading) {
      // 自动填充输入框
      setInputValue(initialPrompt);
      // 清除 location.state 避免重复发送
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [initialPrompt, loadingHistory]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const currentPrompt = inputValue;
    setCurrentInput(currentPrompt);
    setInputValue('');
    setLoading(true);

    // Direct Chat 模式
    if (mode === 'direct-chat') {
      if (!model) {
        antdMessage.error('请先在顶部选择一个模型');
        setLoading(false);
        return;
      }

      setDirectChatVoted(false);
      const userMessage = { id: Date.now(), content: currentPrompt, isUser: true };
      setMessages(prev => [...prev, userMessage]);

      // 如果用户已登录，保存用户消息到后端
      if (user && id) {
        try {
          await request.post('models/chat/message/', {
            conversation_id: id,
            content: currentPrompt,
            is_user: true
          });
        } catch (err) {
          console.error('Failed to save user message:', err);
        }
      }

      try {
        // 使用 URL 中的 id 作为 conversation_id，这样可以保持连续对话
        const res = await evaluateModel(model.name, currentPrompt, id);
        const aiMessage = { id: Date.now() + 1, content: res.data.response, isUser: false };
        setMessages(prev => [...prev, aiMessage]);

        // 如果用户已登录，保存AI回复到后端
        if (user && id) {
          try {
            await request.post('models/chat/message/', {
              conversation_id: id,
              content: res.data.response,
              is_user: false,
              model_name: model.name
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
      return;
    }

    // Side-by-side 模式
    if (mode === 'side-by-side') {
      if (!leftModel || !rightModel) {
        antdMessage.error('请在顶部选择两个模型进行比较');
        setLoading(false);
        return;
      }

      setVoted(false);
      const userMessage = { content: currentPrompt, isUser: true };
      setLeftMessages(prev => [...prev, userMessage]);
      setRightMessages(prev => [...prev, userMessage]);

      // 保存用户消息到后端
      if (user && id) {
        try {
          await request.post('models/chat/message/', {
            conversation_id: id,
            content: currentPrompt,
            is_user: true
          });
        } catch (err) {
          console.error('Failed to save user message:', err);
        }
      }

      try {
        // 使用 URL 中的 id 作为 conversation_id，保持连续对话
        const [leftResponse, rightResponse] = await Promise.all([
          evaluateModel(leftModel, currentPrompt, id).catch(err => ({ error: err })),
          evaluateModel(rightModel, currentPrompt, id).catch(err => ({ error: err }))
        ]);

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
          
          // 保存左侧模型的 AI 回复
          if (user && id) {
            try {
              await request.post('models/chat/message/', {
                conversation_id: id,
                content: leftResponse.data.response,
                is_user: false,
                model_name: leftModel
              });
            } catch (err) {
              console.error('Failed to save left AI message:', err);
            }
          }
        }

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
          
          // 保存右侧模型的 AI 回复
          if (user && id) {
            try {
              await request.post('models/chat/message/', {
                conversation_id: id,
                content: rightResponse.data.response,
                is_user: false,
                model_name: rightModel
              });
            } catch (err) {
              console.error('Failed to save right AI message:', err);
            }
          }
        }
      } catch (error) {
        setBattleError(`发生错误: ${error.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Battle 模式 - 在已保存的会话中，不重新随机选择模型，而是使用已选择的模型
    if (mode === 'battle') {
      let modelA = leftModel;
      let modelB = rightModel;
      
      // 如果还没有选择模型，随机选择
      if (!leftModel || !rightModel) {
        // 过滤掉图片和视频模型
        const filteredModels = models.filter(m => m.task !== 'image' && m.task !== 'video');
        
        if (filteredModels.length < 2) {
          antdMessage.error('当前模式下可用模型不足 (<2)，无法开始对战');
          setLoading(false);
          return;
        }

        // 随机选择两个不重复的模型
        const modelIndices = new Set();
        while (modelIndices.size < 2) {
          modelIndices.add(Math.floor(Math.random() * filteredModels.length));
        }
        const [indexA, indexB] = Array.from(modelIndices);
        modelA = filteredModels[indexA].name;
        modelB = filteredModels[indexB].name;
        
        setLeftModel(modelA);
        setRightModel(modelB);
        
        // 更新会话的 model_name 为 "modelA vs modelB"
        if (user && id) {
          try {
            console.log('Updating conversation model_name:', `${modelA} vs ${modelB}`);
            const response = await request.patch(`models/chat/conversation/${id}/`, {
              model_name: `${modelA} vs ${modelB}`
            });
            console.log('Conversation updated successfully:', response.data);
          } catch (err) {
            console.error('Failed to update conversation model_name:', err);
          }
        }
      }

      setVoted(false);
      setBattleError(null);

      const userMessage = { content: currentPrompt, isUser: true };
      // 不要清空历史，而是追加消息
      setLeftMessages(prev => [...prev, userMessage]);
      setRightMessages(prev => [...prev, userMessage]);

      // 保存用户消息到后端
      if (user && id) {
        try {
          await request.post('models/chat/message/', {
            conversation_id: id,
            content: currentPrompt,
            is_user: true
          });
        } catch (err) {
          console.error('Failed to save user message:', err);
        }
      }

      try {
        // 使用已选择的模型和 conversation_id 进行连续对话
        const [leftResponse, rightResponse] = await Promise.all([
          evaluateModel(modelA, currentPrompt, id).catch(err => ({ error: err })),
          evaluateModel(modelB, currentPrompt, id).catch(err => ({ error: err }))
        ]);

        if (leftResponse.error) {
          const errorMessage = { content: `调用模型出错: ${leftResponse.error.message}`, isUser: false, isError: true };
          setLeftMessages(prev => [...prev, errorMessage]);
        } else {
          const aiMessage = { content: leftResponse.data.response, isUser: false };
          setLeftMessages(prev => [...prev, aiMessage]);
          
          // 保存左侧模型的 AI 回复
          if (user && id) {
            try {
              await request.post('models/chat/message/', {
                conversation_id: id,
                content: leftResponse.data.response,
                is_user: false,
                model_name: modelA
              });
            } catch (err) {
              console.error('Failed to save left AI message:', err);
            }
          }
        }

        if (rightResponse.error) {
          const errorMessage = { content: `调用模型出错: ${rightResponse.error.message}`, isUser: false, isError: true };
          setRightMessages(prev => [...prev, errorMessage]);
        } else {
          const aiMessage = { content: rightResponse.data.response, isUser: false };
          setRightMessages(prev => [...prev, aiMessage]);
          
          // 保存右侧模型的 AI 回复
          if (user && id) {
            try {
              await request.post('models/chat/message/', {
                conversation_id: id,
                content: rightResponse.data.response,
                is_user: false,
                model_name: modelB
              });
            } catch (err) {
              console.error('Failed to save right AI message:', err);
            }
          }
        }
      } catch (error) {
        setBattleError(`发生错误: ${error.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }
  };

  const handleVote = async (winnerChoice) => {
    if (!currentInput) {
      antdMessage.error("无法找到用于投票的提示。");
      return;
    }

    const voteData = {
      model_a: leftModel,
      model_b: rightModel,
      prompt: currentInput,
      winner: winnerChoice,
    };

    try {
      await recordVote(voteData);
      antdMessage.success('感谢您的投票！');
      setVoted(true);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      console.error("Vote failed:", error.response?.data || error);
      antdMessage.error(`投票失败: ${errorMsg}`);
    }
  };

  const handleDirectChatVote = async (choice) => {
    const lastUserMessage = messages.filter(m => m.isUser).pop();
    const lastAiMessage = messages.filter(m => !m.isUser && !m.isError).pop();

    if (!lastUserMessage || !lastAiMessage) {
      antdMessage.error("无法找到用于投票的对话。");
      return;
    }

    const voteData = {
      model_a: leftModel,
      model_b: null,
      prompt: lastUserMessage.content,
      winner: choice,
    };

    try {
      await recordVote(voteData);
      antdMessage.success('感谢您的反馈！');
      setDirectChatVoted(true);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      antdMessage.error(`提交反馈失败: ${errorMsg}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ color: '#8c8c8c', marginTop: 4 }}>
          {mode === 'battle' && '模式: Battle (盲测对战)'}
          {mode === 'side-by-side' && `模式: Side by Side - ${leftModel || 'Model A'} vs ${rightModel || 'Model B'}`}
          {mode === 'direct-chat' && `模式: Direct Chat - ${model ? model.name : '未选择'}`}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: mode === 'direct-chat' ? 'auto' : 'hidden', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
        {loadingHistory ? (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Spin /> 加载历史消息...
          </div>
        ) : mode === 'direct-chat' ? (
          // Direct Chat 模式渲染
          <>
            {messages.length === 0 ? (
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
                      <div style={{ background: message.isUser ? '#000' : '#f5f5f5', color: message.isUser ? '#fff' : '#000', padding: '8px 12px', borderRadius: 12, maxWidth: '70%', overflowX: 'auto' }}>
                        {message.isUser ? (
                          message.content
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
                            {normalizeTexDelimiters(String(message.content || ''))}
                          </ReactMarkdown>
                        )}
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
          </>
        ) : (
          // Battle 和 Side-by-side 模式渲染
          <>
            {leftMessages.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', paddingTop: '15vh' }}>
                <Title level={3} style={{ color: '#ccc' }}>
                  {mode === 'battle' ? 'Battle Mode - 两个匿名模型将回答您的问题' : `Compare ${leftModel || 'Model A'} vs ${rightModel || 'Model B'}`}
                </Title>
              </div>
            ) : (
              <Row gutter={16} style={{ height: '100%' }}>
                <Col span={12} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #f0f0f0', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>
                    {mode === 'side-by-side' ? (leftModel || 'Model A') : '模型 A'}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    {leftMessages.map((msg, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                        {!msg.isUser && (
                          <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />
                        )}
                        <div style={{ background: msg.isUser ? '#000' : (msg.isError ? '#ffebee' : '#f5f5f5'), color: msg.isUser ? 'white' : (msg.isError ? '#c62828' : 'black'), padding: '8px 12px', borderRadius: '8px', maxWidth: '80%', wordBreak: 'break-word', overflowX: 'auto' }}>
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
                          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#000', marginLeft: 8 }} />
                        )}
                      </div>
                    ))}
                    {loading && (
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
                      <div key={index} style={{ display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                        {!msg.isUser && (
                          <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />
                        )}
                        <div style={{ background: msg.isUser ? '#000' : (msg.isError ? '#ffebee' : '#f5f5f5'), color: msg.isUser ? 'white' : (msg.isError ? '#c62828' : 'black'), padding: '8px 12px', borderRadius: '8px', maxWidth: '80%', wordBreak: 'break-word', overflowX: 'auto' }}>
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
                          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#000', marginLeft: 8 }} />
                        )}
                      </div>
                    ))}
                    {loading && (
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
          </>
        )}
      </div>

      {/* 投票按钮 - Battle 和 Side-by-side 模式 */}
      {(mode === 'side-by-side' || mode === 'battle') && leftMessages.length > 0 && !loading && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          {battleError && <Alert message={battleError} type="error" closable onClose={() => setBattleError(null)} style={{ marginBottom: 8 }} />}
          <Title level={5}>哪个模型的回答更好？</Title>
          <Space>
            <Button onClick={() => handleVote(mode === 'battle' ? 'model_a' : leftModel)} disabled={voted}>
              ← 左边更好
            </Button>
            <Button onClick={() => handleVote('tie')} disabled={voted}>不分上下</Button>
            <Button onClick={() => handleVote('bad')} disabled={voted}>都很差</Button>
            <Button onClick={() => handleVote(mode === 'battle' ? 'model_b' : rightModel)} disabled={voted}>
              → 右边更好
            </Button>
          </Space>
        </div>
      )}

      {/* 投票按钮 - Direct Chat 模式 */}
      {mode === 'direct-chat' && messages.some(m => !m.isUser && !m.isError) && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Space>
            <Button onClick={() => handleDirectChatVote('good')} disabled={directChatVoted}>👍 Good</Button>
            <Button onClick={() => handleDirectChatVote('bad')} disabled={directChatVoted}>👎 Bad</Button>
          </Space>
        </div>
      )}

      {/* 输入框 */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <TextArea 
          value={inputValue} 
          onChange={e => setInputValue(e.target.value)} 
          placeholder="输入您的问题..." 
          autoSize={{ minRows: 1, maxRows: 4 }} 
          onPressEnter={(e) => { 
            if (!e.shiftKey) { 
              e.preventDefault(); 
              handleSend(); 
            } 
          }} 
        />
        <Button 
          type="primary" 
          icon={<SendOutlined />} 
          onClick={handleSend} 
          disabled={!inputValue.trim() || loading}
          loading={loading}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
