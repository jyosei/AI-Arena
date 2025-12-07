import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { List, Avatar, Input, Button, Spin, message as antdMessage, Typography, Row, Col, Space, Alert ,Tooltip} from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, PaperClipOutlined, CloseCircleFilled,PictureOutlined  } from '@ant-design/icons';
import apiClient from '../api/apiClient';
import request from '../api/request';
import { useChat } from '../contexts/ChatContext';
import { useMode } from '../contexts/ModeContext';
import AuthContext from '../contexts/AuthContext';
import { evaluateModel, recordVote, battleModels } from '../api/models';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import MarkdownTypewriter from '../components/MarkdownTypewriter';
import { Plus, Globe, Image as ImageIcon, Code } from 'lucide-react';
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

// 移除尾部意外的 "undefined" 或 "$$undefined"
function stripTrailingUndefined(text) {
  if (!text) return '';
  let t = String(text);
  t = t.replace(/(\s*\$\$undefined\s*)$/i, '');
  t = t.replace(/(\s*undefined\s*)$/i, '');
  return t;
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
  // Direct Chat 独立模型选择，避免影响 battle/side-by-side 的左右模型
  const [directModel, setDirectModel] = useState(null);

  const conv = chatHistory.find(c => String(c.id) === String(id));
  const title = conv ? conv.title : '会话';
  const savedMode = conv?.mode || 'direct-chat';

  // 从会话数据中解析模型名称（用于显示）
  const displayLeftModel = React.useMemo(() => {
    if (!conv?.model_name) return leftModel;
    if ((savedMode === 'side-by-side' || savedMode === 'battle') && conv.model_name.includes(' vs ')) {
      const [left] = conv.model_name.split(' vs ').map(s => s.trim());
      return left || leftModel;
    }
    return conv.model_name || leftModel;
  }, [conv?.model_name, savedMode, leftModel]);

  const displayRightModel = React.useMemo(() => {
    if (!conv?.model_name) return rightModel;
    if ((savedMode === 'side-by-side' || savedMode === 'battle') && conv.model_name.includes(' vs ')) {
      const [, right] = conv.model_name.split(' vs ').map(s => s.trim());
      return right || rightModel;
    }
    return rightModel;
  }, [conv?.model_name, savedMode, rightModel]);

  // 从 location.state 获取初始消息与图片
  const initialPrompt = location.state?.initialPrompt;
  const initialImage = location.state?.initialImage;
  const autoSentRef = useRef(false);
  const [shouldAutoSend, setShouldAutoSend] = useState(false);
  const iconButtonStyle = {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#e0e0e0',
  };
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
        // Direct Chat 模式：不影响全局 leftModel，使用局部 directModel
        setDirectModel(conv.model_name);
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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const imageModels = useMemo(() => models.filter(m => m.capabilities.includes('image_generation')), [models]);
  const textModels = useMemo(() => models.filter(m => m.capabilities.includes('chat')), [models]);

  // --- 关键修改 1: 添加图片状态和 Ref ---
  const [uploadedImage, setUploadedImage] = useState(null); // 存储 File 对象
  const imageInputRef = useRef(null); // 用于触发隐藏的 input

  // 选择模型：优先使用对话保存的模型，然后使用 ModeContext 的 leftModel，最后回退到第一个 models
  const savedModelName = conv?.model_name;
  const modelName = useMemo(() => {
    if (isGeneratingImage) {
      // 生成图片模式使用 directModel，避免污染全局 leftModel
      return directModel && imageModels.some(m => m.name === directModel) ? directModel : imageModels[0]?.name;
    }
    if (mode === 'direct-chat') {
      // Direct Chat 优先会话保存的模型，其次本地 directModel，再次默认文本模型
      return conv?.model_name || directModel || textModels[0]?.name;
    }
    // 其他模式保持全局左右模型
    return conv?.model_name || leftModel || textModels[0]?.name;
  }, [isGeneratingImage, mode, directModel, leftModel, conv?.model_name, textModels, imageModels]);

  const model = models.find(m => m.name === modelName) || null;

  // 确认模型准备就绪后再自动发送，避免过早发送导致失败
  const modelReady = useMemo(() => {
    if (mode === 'direct-chat') {
      if (isGeneratingImage) {
        return !!model && model.capabilities?.includes('image_generation');
      }
      return !!model;
    }
    if (mode === 'side-by-side') {
      return !!leftModel && !!rightModel;
    }
    if (mode === 'battle') {
      // 如果已经选择了左右模型则认为就绪；否则至少需要具备两个可聊天模型
      if (leftModel && rightModel) return true;
      const chatCapable = models.filter(m => m.capabilities?.includes('chat'));
      return chatCapable.length >= 2;
    }
    return false;
  }, [mode, model, leftModel, rightModel, models, isGeneratingImage]);

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
          created_at: msg.created_at,
          // --- 关键修改: 加载历史图片 ---
          image: msg.image || null,
          animate: false, // 历史消息不启用打字机
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
          let leftModelName = displayLeftModel;
          let rightModelName = displayRightModel;
          if (conv?.model_name && conv.model_name.includes(' vs ')) {
            [leftModelName, rightModelName] = conv.model_name.split(' vs ').map(s => s.trim());
          }

          // 如果保存的模型名与历史AI消息不一致，则从历史里推断
          const aiModels = [...new Set(adapted.filter(m => !m.isUser && m.model_name).map(m => m.model_name))];
          const isValid = (name) => !!name && aiModels.includes(name);
          if (!isValid(leftModelName) || !isValid(rightModelName)) {
            if (aiModels.length >= 2) {
              leftModelName = aiModels[0];
              rightModelName = aiModels[1];
            } else if (aiModels.length === 1) {
              leftModelName = aiModels[0];
              rightModelName = aiModels[0];
            }
          }
          
          console.log('Loading side-by-side messages:', {
            leftModelName,
            rightModelName,
            totalMessages: adapted.length
          });
          
          adapted.forEach((msg, index) => {
            console.log(`Message ${index}:`, {
              isUser: msg.isUser,
              model_name: msg.model_name,
              content: msg.content.substring(0, 30)
            });
            
            if (msg.isUser) {
              // 用户消息同时显示在两边
              leftModelMessages.push({ ...msg, id: `${msg.id}-left` });
              rightModelMessages.push({ ...msg, id: `${msg.id}-right` });
            } else {
              // AI 消息根据 model_name 分配
              if (msg.model_name === leftModelName) {
                leftModelMessages.push(msg);
              } else if (msg.model_name === rightModelName) {
                rightModelMessages.push(msg);
              } else {
                console.warn('Message with unknown model_name:', msg.model_name, 'Expected:', leftModelName, 'or', rightModelName);
              }
            }
          });
          
          console.log('Final message counts:', {
            left: leftModelMessages.length,
            right: rightModelMessages.length
          });
          
          setLeftMessages(leftModelMessages);
          setRightMessages(rightModelMessages);
          setMessages([]);
        } else if (savedMode === 'battle') {
          // Battle 模式：也加载历史消息（与 side-by-side 逻辑相同）
          const leftModelMessages = [];
          const rightModelMessages = [];
          
          console.log('Battle mode initial state:', {
            convModelName: conv?.model_name,
            displayLeftModel,
            displayRightModel,
            leftModel,
            rightModel
          });
          
          // 从 conv.model_name 解析左右模型名称（使用 displayLeftModel/displayRightModel）
          let leftModelName = displayLeftModel;
          let rightModelName = displayRightModel;
          if (conv?.model_name && conv.model_name.includes(' vs ')) {
            [leftModelName, rightModelName] = conv.model_name.split(' vs ').map(s => s.trim());
          }

          // 关键：根据历史 AI 消息推断或校正左右模型名
          const aiMsgs = adapted.filter(msg => !msg.isUser && msg.model_name);
          const uniqueModels = [...new Set(aiMsgs.map(m => m.model_name))];
          const isValidBattle = (name) => !!name && uniqueModels.includes(name);
          if (!isValidBattle(leftModelName) || !isValidBattle(rightModelName)) {
            if (uniqueModels.length >= 2) {
              leftModelName = uniqueModels[0];
              rightModelName = uniqueModels[1];
            } else if (uniqueModels.length === 1) {
              leftModelName = uniqueModels[0];
              rightModelName = uniqueModels[0];
            }
          }
          
          console.log('Battle mode loading:', { 
            leftModelName, 
            rightModelName,
            messageCount: adapted.length 
          });
          
          adapted.forEach((msg, index) => {
            console.log(`Battle Message ${index}:`, {
              isUser: msg.isUser,
              model_name: msg.model_name,
              content: msg.content.substring(0, 30),
              leftMatch: msg.model_name === leftModelName,
              rightMatch: msg.model_name === rightModelName
            });
            
            if (msg.isUser) {
              leftModelMessages.push({ ...msg, id: `${msg.id}-left` });
              rightModelMessages.push({ ...msg, id: `${msg.id}-right` });
            } else {
              // AI 消息根据 model_name 分配
              if (msg.model_name === leftModelName) {
                leftModelMessages.push(msg);
              } else if (msg.model_name === rightModelName) {
                rightModelMessages.push(msg);
              } else {
                console.warn('Battle message with unknown model_name:', msg.model_name, 'Expected:', leftModelName, 'or', rightModelName);
              }
            }
          });
          
          console.log('Battle final message counts:', {
            left: leftModelMessages.length,
            right: rightModelMessages.length
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

  // 处理从首页传来的初始消息与图片，并自动发送一次
  // 第一步：接收首页带来的初始输入，存到本地状态，并设置 shouldAutoSend
  useEffect(() => {
    if ((initialPrompt || initialImage) && !autoSentRef.current) {
      if (initialPrompt) setInputValue(initialPrompt);
      if (initialImage) setUploadedImage(initialImage);
      autoSentRef.current = true;
      setShouldAutoSend(true);
      // 立刻清空路由 state，防止后退/刷新重复触发
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [initialPrompt, initialImage, navigate]);

  // 第二步：当模型就绪、历史加载完成，且标记为 shouldAutoSend 时触发一次发送
  useEffect(() => {
    if (
      shouldAutoSend &&
      !loadingHistory &&
      !loading &&
      modelReady &&
      (inputValue.trim() || uploadedImage)
    ) {
      setShouldAutoSend(false);
      handleSend();
    }
  }, [shouldAutoSend, loadingHistory, loading, modelReady, inputValue, uploadedImage]);

  // --- 关键修改 2: 添加图片选择和移除的处理函数 ---
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedImage(file);
    }
    event.target.value = null; // 允许重复选择同一文件
  };

  const removeImage = () => {
    setUploadedImage(null);
  };
  const toggleImageGeneration = () => {
    setIsGeneratingImage(prev => {
      const nextState = !prev;
      if (nextState) {
        // 进入生成图片模式
        setUploadedImage(null); // 清除已上传的图片
        if (imageModels.length > 0) {
          setDirectModel(imageModels[0].name); // 自动选择第一个图片模型（本地）
        } else {
          antdMessage.warning('没有可用的图片生成模型。');
          return false; // 阻止切换
        }
      } else {
        // 退出生成图片模式，恢复到默认文本模型
        if (textModels.length > 0) {
          setDirectModel(textModels[0].name);
        }
      }
      return nextState;
    });
  };
  const handleSend = async () => {
    // --- 关键修改 3: 更新发送条件 ---
    if (!inputValue.trim() && !uploadedImage) return;

    const currentPrompt = inputValue;
    const currentImage = uploadedImage; // 获取当前图片 File 对象
    setCurrentInput(currentPrompt);
    setInputValue('');
    setUploadedImage(null); // 发送后清空
    setLoading(true);

    // --- 关键修改 4: 创建包含图片预览 URL 的用户消息 ---
    const userMessage = { 
      id: Date.now(), 
      content: currentPrompt, 
      isUser: true,
      image: currentImage ? URL.createObjectURL(currentImage) : null
    };
    if (isGeneratingImage) {
      if (!model || !model.capabilities.includes('image_generation')) {
        antdMessage.error('请先在顶部选择一个图片生成模型');
        setLoading(false);
        return;
      }
      setMessages(prev => [...prev, userMessage]);
      try {
        // 调用 evaluateModel，后端应能处理图片生成任务
        const res = await evaluateModel(model.name, currentPrompt, id, null, true); // 图片生成不上传图片，保存用户消息
        // 假设后端返回的 response 是图片 URL
        const aiMessage = { 
          id: Date.now() + 1, 
          content: `为您生成的图片，提示词: "${currentPrompt}"`, 
          isUser: false,
          image: res.data.response // 将返回的 URL 作为图片源
        };
        setMessages(prev => [...prev, aiMessage]);
        // (可选) 保存AI消息到后端，需要后端支持保存图片URL
      } catch (err) {
        console.error('Image generation failed:', err);
        const errMsg = { id: Date.now() + 1, content: `图片生成失败: ${err.response?.data?.error || err.message}`, isUser: false, isError: true };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
      return;
    }
    // Direct Chat 模式
    if (mode === 'direct-chat') {
      if (!model) {
        antdMessage.error('请先在顶部选择一个模型');
        setLoading(false);
        return;
      }

      setDirectChatVoted(false);
      setMessages(prev => [...prev, userMessage]);

      // 不需要手动保存用户消息，evaluateModel 会自动保存

      try {
        // evaluateModel 会自动保存用户消息和AI回复
        const res = await evaluateModel(model.name, currentPrompt, id, currentImage, true);
        const aiMessage = { id: Date.now() + 1, content: res.data.response, isUser: false, model_name: model.name, animate: true };
        setMessages(prev => [...prev, aiMessage]);

        // 不需要手动保存AI消息，后端已自动保存
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
      setLeftMessages(prev => [...prev, userMessage]);
      setRightMessages(prev => [...prev, userMessage]);

      try {
        // 使用统一的 battleModels API,mode 参数设置为 'side-by-side'
        const response = await battleModels(leftModel, rightModel, currentPrompt, id, 'side-by-side');
        
        // 解析响应 - 后端返回 { prompt, results: [{model, response}, {model, response}], conversation_id }
        const { results, conversation_id } = response.data;
        
        // 根据模型名称分配响应到左右两侧
        results.forEach(result => {
          const aiMessage = { 
            id: Date.now() + Math.random(), 
            content: result.response, 
            isUser: false,
            model_name: result.model,
            animate: true
          };
          
          if (result.model === leftModel) {
            setLeftMessages(prev => [...prev, aiMessage]);
          } else if (result.model === rightModel) {
            setRightMessages(prev => [...prev, aiMessage]);
          }
        });

        // 如果这是新创建的会话,更新URL
        if (!id && conversation_id) {
          navigate(`/chat/${conversation_id}`, { replace: true });
        }

      } catch (err) {
        console.error('Side-by-side battle failed:', err);
        const errMsg = { 
          id: Date.now(), 
          content: `请求失败: ${err.response?.data?.error || err.message}`, 
          isUser: false, 
          isError: true 
        };
        setLeftMessages(prev => [...prev, errMsg]);
        setRightMessages(prev => [...prev, errMsg]);
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
      if (!modelA || !modelB) {
        // 过滤掉图片和视频模型
        const requiredCapability = currentImage ? 'vision' : 'chat';
        const filteredModels = models.filter(m => m.capabilities.includes(requiredCapability));

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
      }

      setVoted(false);
      setBattleError(null);

      setLeftMessages(prev => [...prev, userMessage]);
      setRightMessages(prev => [...prev, userMessage]);

      try {
        // 使用统一的 battleModels API
        const response = await battleModels(modelA, modelB, currentPrompt, id, 'battle');
        
        // 解析响应
        const { results, conversation_id, is_anonymous } = response.data;
        
        // 如果是匿名对战,results 顺序已被打乱,需要显示但不透露模型名
        // 如果不是匿名,按模型名分配
        if (is_anonymous) {
          // 匿名对战:不知道哪个是哪个,按顺序显示
          const [result1, result2] = results;
          setLeftMessages(prev => [...prev, { 
            id: Date.now(), 
            content: result1.response, 
            isUser: false,
            model_name: result1.model, // 保存真实模型名,但界面不显示
            animate: true
          }]);
          setRightMessages(prev => [...prev, { 
            id: Date.now() + 1, 
            content: result2.response, 
            isUser: false,
            model_name: result2.model,
            animate: true
          }]);
        } else {
          // 非匿名:根据模型名分配
          results.forEach(result => {
            const aiMessage = { 
              id: Date.now() + Math.random(), 
              content: result.response, 
              isUser: false,
              model_name: result.model,
              animate: true
            };
            
            if (result.model === modelA) {
              setLeftMessages(prev => [...prev, aiMessage]);
            } else if (result.model === modelB) {
              setRightMessages(prev => [...prev, aiMessage]);
            }
          });
        }

        // 如果这是新创建的会话,更新URL
        if (!id && conversation_id) {
          navigate(`/chat/${conversation_id}`, { replace: true });
        }

      } catch (error) {
        setBattleError(`发生错误: ${error.response?.data?.error || error.message}`);
        const errMsg = { 
          id: Date.now(), 
          content: `请求失败: ${error.response?.data?.error || error.message}`, 
          isUser: false, 
          isError: true 
        };
        setLeftMessages(prev => [...prev, errMsg]);
        setRightMessages(prev => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
      return;
    }
  };

  const handleVote = async (winnerChoice) => {
    // 从消息历史中找到最后一个用户消息作为 prompt
    const lastUserMessage = leftMessages.filter(m => m.isUser).pop();

    if (!lastUserMessage || !lastUserMessage.content) {
      antdMessage.error("无法找到用于投票的原始问题。");
      return;
    }

    // 在匿名 battle 模式下，leftModel/rightModel 可能未设置；
    // 使用左右侧最新 AI 消息的真实 model_name 作为提交的模型名。
    const lastLeftAi = [...leftMessages].reverse().find(m => !m.isUser && !m.isError && m.model_name);
    const lastRightAi = [...rightMessages].reverse().find(m => !m.isUser && !m.isError && m.model_name);
    const modelAName = lastLeftAi?.model_name || leftModel;
    const modelBName = lastRightAi?.model_name || rightModel;

    if (!modelAName || !modelBName) {
      antdMessage.error('无法确定参与对战的模型名称。请重新开始对战。');
      return;
    }

    const voteData = {
      model_a: modelAName,
      model_b: modelBName,
      prompt: lastUserMessage.content, // 使用从历史记录中找到的 prompt
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
    let winnerValue;
    if (choice === 'good') {
      // 用户觉得好：direct-chat 模式将当前模型作为胜者
      winnerValue = directModel || model?.name || leftModel;
    } else {
      // 用户觉得不好：统一传递 'bad'，后端映射为 'both_bad'
      winnerValue = 'bad';
    }
    const voteData = {
      model_a: directModel || model?.name || leftModel,
      model_b: null,
      prompt: lastUserMessage.content,
      winner: winnerValue,
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

  // --- 关键修改 7: 封装消息渲染逻辑以便复用 ---
  const renderMessageContent = (message) => (
    <>
      {message.image && (
        <img 
          src={message.image} 
          alt="用户上传" 
          style={{ 
            maxWidth: '100%', 
            maxHeight: '250px', 
            borderRadius: '4px', 
            marginBottom: message.content ? '8px' : '0',
            display: 'block'
          }} 
        />
      )}
      {message.isUser ? (
        message.content
      ) : (
        <MarkdownTypewriter
          source={stripTrailingUndefined(normalizeTexDelimiters(String(message.content || '')))}
          enabled={!!message.animate}
          speed={50}
          by="word"
        />
      )}
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* 页面标题部分 (保持不变) */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ color: '#8c8c8c', marginTop: 4 }}>
          {isGeneratingImage && `模式: 生成图片 - ${model ? model.name : '未选择'}`}
          {!isGeneratingImage && savedMode === 'battle' && '模式: Battle (盲测对战)'}
          {!isGeneratingImage && savedMode === 'side-by-side' && `模式: Side by Side - ${displayLeftModel || 'Model A'} vs ${displayRightModel || 'Model B'}`}
          {!isGeneratingImage && savedMode === 'direct-chat' && `模式: Direct Chat - ${model ? model.name : '未选择'}`}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'hidden', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
        {loadingHistory ? (
          <div style={{ textAlign: 'center', marginTop: 40 }}><Spin /> 加载历史消息...</div>
        ) : mode === 'direct-chat' ? (
          <div style={{ height: '100%', overflowY: 'auto' }}>
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
                      <div className={`bubble ${message.isError ? 'bubble--error' : (message.isUser ? 'bubble--user' : 'bubble--ai')}`}>
                        {renderMessageContent(message)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 8 }}>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 12 }} />
                <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 12 }}><Spin size="small" /> AI 正在思考...</div>
              </div>
            )}
          </div>
        ) : (
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
                        {!msg.isUser && <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />}
                        <div className={`bubble ${msg.isError ? 'bubble--error' : (msg.isUser ? 'bubble--user' : 'bubble--ai')}`} style={{ maxWidth: '80%' }}>
                          {renderMessageContent(msg)}
                        </div>
                        {msg.isUser && <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#000', marginLeft: 8 }} />}
                      </div>
                    ))}
                    {loading && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
                        <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />
                        <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: '8px' }}><Spin size="small" /> 思考中...</div>
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
                        {!msg.isUser && <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />}
                        <div className={`bubble ${msg.isError ? 'bubble--error' : (msg.isUser ? 'bubble--user' : 'bubble--ai')}`} style={{ maxWidth: '80%' }}>
                          {renderMessageContent(msg)}
                        </div>
                        {msg.isUser && <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#000', marginLeft: 8 }} />}
                      </div>
                    ))}
                    {loading && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
                        <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#595959', marginRight: 8 }} />
                        <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: '8px' }}><Spin size="small" /> 思考中...</div>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            )}
          </>
        )}
      </div>

      {(mode === 'side-by-side' || mode === 'battle') && leftMessages.length > 0 && !loading && !voted && (
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          {battleError && <Alert message={battleError} type="error" closable onClose={() => setBattleError(null)} style={{ marginBottom: 8 }} />}
          <Title level={5}>哪个模型的回答更好？</Title>
          <Space wrap size={[8,8]} style={{ justifyContent: 'center' }}>
            <Button style={{ minWidth: 120 }} onClick={() => handleVote(leftModel)} disabled={voted}>← 左边更好</Button>
            <Button style={{ minWidth: 120 }} onClick={() => handleVote('tie')} disabled={voted}>不分上下</Button>
            <Button style={{ minWidth: 120 }} onClick={() => handleVote('bad')} disabled={voted}>都很差</Button>
            <Button style={{ minWidth: 120 }} onClick={() => handleVote(rightModel)} disabled={voted}>→ 右边更好</Button>
          </Space>
        </div>
      )}
      {mode === 'direct-chat' && messages.some(m => !m.isUser && !m.isError) && !directChatVoted &&(
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Space wrap size={[8,8]} style={{ justifyContent: 'center' }}>
            <Button style={{ minWidth: 120 }} onClick={() => handleDirectChatVote('good')} disabled={directChatVoted}>👍 Good</Button>
            <Button style={{ minWidth: 120 }} onClick={() => handleDirectChatVote('bad')} disabled={directChatVoted}>👎 Bad</Button>
          </Space>
        </div>
      )}

        <div style={{ flexShrink: 0, padding: '0 20px 20px 20px' }}>
        {uploadedImage && (
          <div style={{ maxWidth: '800px', margin: '0 auto 12px auto', position: 'relative', display: 'inline-block' }}>
            <img src={URL.createObjectURL(uploadedImage)} alt="preview" style={{ height: 60, borderRadius: 4, border: '1px solid #d9d9d9' }} />
            <Button icon={<CloseCircleFilled />} size="small" shape="circle" danger onClick={removeImage} style={{ position: 'absolute', top: -8, right: -8 }} />
          </div>
        )}
        <div style={{ 
          border: '1px solid #e0e0e0',
          borderRadius: '18px',
          padding: '12px',
          background: '#fff',
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column', // 垂直布局
          gap: '12px' // 文本框和按钮行的间距
        }}>
          {/* 文本输入框 */}
          <TextArea
            autoSize={{ minRows: 1, maxRows: 6 }}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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
            onPressEnter={e => !e.shiftKey && (e.preventDefault(), handleSend())}
          />

          {/* 隐藏的文件输入 */}
          <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />

          {/* 功能按钮行 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Tooltip title="上传文件 (占位)">
              <Button style={iconButtonStyle} icon={<Plus size={20} />} />
            </Tooltip>
            <Tooltip title="搜索网络 (占位)">
              <Button style={iconButtonStyle} icon={<Globe size={20} />} />
            </Tooltip>
            <Tooltip title="上传图片">
              <Button 
                style={iconButtonStyle} 
                icon={<ImageIcon size={20} />} 
                onClick={() => imageInputRef.current.click()}
                disabled={isGeneratingImage}
              />
            </Tooltip>
            <Tooltip title="生成图片">
              <Button 
                style={iconButtonStyle} 
                icon={<Code size={20} />} // 使用 Code 图标代表生成
                onClick={toggleImageGeneration}
                type={isGeneratingImage ? 'primary' : 'default'}
              />
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}