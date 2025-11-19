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
    // --- 关键修改：将 prompt 和 image 的校验提前 ---
    if (!prompt.trim() && !uploadedImage) {
      // 如果文本和图片都为空，则不执行任何操作
      return;
    }

    const currentPrompt = prompt;
    const currentImage = uploadedImage;
    setCurrentInput(currentPrompt);
    setPrompt('');
    setUploadedImage(null);

    // --- 1. 统一处理图片生成逻辑，无论在哪种 mode 下 ---
    if (generationMode === 'image') {
      setBattleLoading(true);
      setImageUrl(null);
      setImageError(null);
      // Battle 模式下也显示左右两个加载动画
      if (mode === 'battle') {
        const userMessage = { content: currentPrompt, isUser: true };
        setLeftMessages([userMessage]);
        setRightMessages([userMessage]);
      }
      try {
        // 在 Battle 模式下，我们其实可以同时调用两个图片生成 API
        // 但为了简化，我们先只生成一张图片作为演示
        // 实际应用中可以像文本 Battle 一样 Promise.all
        const response = await generateImage(currentPrompt);
        setImageTaskId(response.data.task_id);
      } catch (error) {
        setImageError(`提交任务失败: ${error.message}`);
        setBattleLoading(false);
      }
      return; // 结束函数
    }

    // Direct Chat 模式
    if (mode === 'direct-chat') {
      // --- 关键修改：在调用 API 前，检查 leftModel 是否存在 ---
      if (!leftModel) {
        message.error('请先在上方选择一个模型！');
        // 将输入框和图片恢复，以便用户可以重新发送
        setPrompt(currentPrompt);
        setUploadedImage(currentImage);
        return; // 阻止后续代码执行
      }

      setDirectChatVoted(false);
      const userMessage = { content: currentPrompt, isUser: true, image: currentImage ? URL.createObjectURL(currentImage) : null };
      setMessages(prev => [...prev, userMessage]);
      setBattleLoading(true);
      try {
        // 现在这里的 leftModel 一定是有值的
        const response = await evaluateModel(leftModel, currentPrompt, directChatConvId, currentImage);
        const aiMessage = { content: response.data.response, isUser: false };
        setMessages(prev => [...prev, aiMessage]);
        if (response.data.conversation_id && !directChatConvId) {
          setDirectChatConvId(response.data.conversation_id);
        }
      } catch (error) {
        const errorMessage = { 
          content: `调用模型出错: ${error.response?.data?.error || error.message}`, 
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
      const userMessage = { content: currentPrompt, isUser: true,        image: currentImage ? URL.createObjectURL(currentImage) : null 
      };
      setLeftMessages(prev => [...prev, userMessage]);
      setRightMessages(prev => [...prev, userMessage]);
      
      setBattleLoading(true);
      setBattleError(null);

      try {
        // 2. 直接使用局部变量 currentPrompt 进行 API 调用
        const [leftResponse, rightResponse] = await Promise.all([
            evaluateModel(leftModel, currentPrompt, leftConvId,currentImage).catch(err => ({ error: err })),
            evaluateModel(rightModel, currentPrompt, rightConvId,currentImage).catch(err => ({ error: err }))
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
      // 使用过滤后的模型列表
      if (filteredModels.length < 2) {
        message.error(`当前模式下模型不足 (<2)，无法开始对战。`);
        return;
      }
      
      // 从 filteredModels 中随机选择两个不重复的模型
      const modelIndices = new Set();
      while (modelIndices.size < 2) {
        modelIndices.add(Math.floor(Math.random() * filteredModels.length));
      }
      const [indexA, indexB] = Array.from(modelIndices);
      const modelA = filteredModels[indexA].name;
      const modelB = filteredModels[indexB].name;

      setVoted(false); // 重置投票状态
      setBattleError(null);

      const userMessage = { content: currentPrompt, isUser: true,        image: currentImage ? URL.createObjectURL(currentImage) : null 
      };
      setLeftMessages([userMessage]); // 开始新对战时，清空并设置用户消息
      setRightMessages([userMessage]);

      setBattleLoading(true);

      try {
        const [leftResponse, rightResponse] = await Promise.all([
            evaluateModel(modelA, currentPrompt,null,currentImage).catch(err => ({ error: err })),
            evaluateModel(modelB, currentPrompt,null,currentImage).catch(err => ({ error: err }))
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
                // --- 关键修改：在这里添加图片和文本的渲染 ---
                <div>
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="user upload" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '200px', 
                        borderRadius: '4px', 
                        marginBottom: msg.content ? '8px' : '0' // 如果有文本，则增加间距
                      }} 
                    />
                  )}
                  {msg.content}
                </div>
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

        {imageUrl && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Title level={4}>图片生成结果</Title>
            <img src={imageUrl} alt={currentInput} style={{ maxWidth: '80%', maxHeight: '512px', borderRadius: '8px', border: '1px solid #eee' }} />
          </div>
        )}
        {battleLoading && imageTaskId && (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Spin size="large" tip="图片正在生成中，请稍候..." />
            </div>
        )}
        {imageError && <Alert message={imageError} type="error" style={{margin: '20px'}} />}
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
