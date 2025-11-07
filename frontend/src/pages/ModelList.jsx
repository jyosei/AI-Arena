import React, { useEffect, useState } from 'react';
// --- 1. 移除不再需要的 List, Card, Link ---
import { 
  Input, Select, Button, Spin, Modal, Typography, Row, Col, 
  Space, Avatar, Alert, Dropdown, Menu, message 
} from 'antd';
// import { Link } from 'react-router-dom'; // 不再需要
import { 
  RobotOutlined, UserOutlined, SendOutlined, LikeOutlined, DislikeOutlined, 
  SwapOutlined, MehOutlined, TableOutlined, ThunderboltOutlined, 
  MessageOutlined, DownOutlined ,UpSquareOutlined
} from '@ant-design/icons';
import{
  ArrowUp,SquareArrowUp
}from 'lucide-react';
import { getModels, evaluateModel, battleModels, recordVote } from '../api/models';
import { useMode } from '../contexts/ModeContext'; // 1. 导入 useMode

const { TextArea } = Input; // Search 不再需要
const { Title, Paragraph } = Typography;

// ChatDialog 组件可以保持不变
function ChatDialog({ visible, onClose, model }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!inputValue.trim() || !model) return;

    const userMessage = { content: inputValue, isUser: true };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setLoading(true);
    
    try {
      const response = await evaluateModel(model.name, currentInput);
      const aiMessage = { content: response.data.response, isUser: false };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = { content: `调用模型出错: ${error.response?.data?.detail || error.message}`, isUser: false };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={model ? `💬 与 ${model.name} 对话` : '💬 与 AI 对话'}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', border: '1px solid #f0f0f0', marginBottom: 16 }}>
          {messages.map((msg, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <Avatar icon={msg.isUser ? <UserOutlined /> : <RobotOutlined />} style={{ order: msg.isUser ? 2 : 1, marginLeft: msg.isUser ? 8 : 0, marginRight: msg.isUser ? 0 : 8 }} />
              <div style={{ background: msg.isUser ? '#1890ff' : '#f5f5f5', color: msg.isUser ? 'white' : 'black', padding: '8px 12px', borderRadius: '8px', maxWidth: '70%' }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && <Spin style={{ marginLeft: 40 }} />}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Input.TextArea value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="输入您的问题..." onPressEnter={e => !e.shiftKey && (e.preventDefault(), handleSend())} />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!inputValue.trim() || loading}>发送</Button>
        </div>
      </div>
    </Modal>
  );
}

// --- 2. 重命名组件以反映其新功能 ---
export default function ArenaPage() {
  // --- 3. 移除与模型列表相关的 State ---
  const [models, setModels] = useState([]);
  const [chatVisible, setChatVisible] = useState(false);
  const [selectedModelForChat, setSelectedModelForChat] = useState(null);
  
  // --- 对战/聊天功能的 State (保持不变) ---
  const [leftModel, setLeftModel] = useState(null);
  const [rightModel, setRightModel] = useState(null);
  const [results, setResults] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState(null);
  const [voted, setVoted] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { mode, setMode } = useMode(); // 2. 从 Context 获取 mode，移除本地的 mode state

  const modelOptions = models.map(m => ({ label: m.name, value: m.name }));

  // --- 4. 简化 fetchModels 函数 ---
  const fetchModels = async () => {
    try {
      // 不再需要加载动画或处理搜索/筛选
      const res = await getModels();
      setModels(res.data || []);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    }
  };

  useEffect(() => { 
    fetchModels(); 
  }, []);

  // 4. (可选但推荐) 监听 mode 变化来清空模型选择
  useEffect(() => {
    setLeftModel(null);
    setRightModel(null);
    setResults([]);
  }, [mode]); // 当从 Header 切换模式时，这个 effect 会触发

  // --- 对战/聊天功能的函数 (保持不变) ---
  const startBattle = async () => {
    if (!prompt.trim()) {
      setBattleError("请输入提示内容。");
      return;
    }
    if (mode === 'side-by-side' && (!leftModel || !rightModel)) {
      setBattleError("请选择左右两个模型。");
      return;
    }

    setBattleLoading(true);
    setBattleError(null);
    setResults([]);
    setVoted(false); // 重置投票状态

    try {
      const payload = mode === 'side-by-side' 
        ? { prompt, modelA: leftModel, modelB: rightModel }
        : { prompt };
      const response = await battleModels(payload);
      setResults(response.data.results);
      setIsAnonymous(response.data.is_anonymous);
    } catch (err) {
      setBattleError(err.response?.data?.error || "请求失败，请稍后重试。");
    } finally {
      setBattleLoading(false);
    }
  };

  const handleVote = async (voteType) => {
    const modelA = results[0].model;
    const modelB = results[1].model;
    let winner;

    switch(voteType) {
      case 'left':
        winner = modelA;
        break;
      case 'right':
        winner = modelB;
        break;
      case 'tie':
        winner = 'tie';
        break;
      case 'both_bad':
        winner = 'both_bad';
        break;
      default:
        return;
    }

    try {
      await recordVote({ modelA, modelB, prompt, winner });
      message.success('感谢您的反馈！');
      setVoted(true); // 标记为已投票，禁用按钮
    } catch (err) {
      message.error('提交反馈失败，请稍后再试。');
      console.error("Failed to record vote:", err);
    }
  };

  return (
    <>
      {/* 5. 移除整个下拉菜单的 Row */}
      {/* <Row justify="space-between" align="middle" ... > ... </Row> */}

      {/* 直接从模型选择器开始 */}
      <Row justify="start" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space wrap size="large">
            <Select
              showSearch
              size="large"
              placeholder={mode === 'direct-chat' ? "选择一个模型" : "选择左侧模型"}
              value={leftModel}
              onChange={setLeftModel}
              style={{ width: 240 }}
              options={modelOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />

            {mode !== 'direct-chat' && (
              <>
                <Typography.Text strong>VS</Typography.Text>
                <Select
                  showSearch
                  size="large"
                  placeholder="选择右侧模型"
                  value={rightModel}
                  onChange={setRightModel}
                  style={{ width: 240 }}
                  options={modelOptions}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </>
            )}
          </Space>
        </Col>
      </Row>

      <div style={{ position: 'relative', marginBottom: 24 }}>
        <TextArea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything..."
          style={{ 
            paddingRight: '50px', // 为发送按钮留出空间
            paddingBottom: '30px' // 为底部按钮留出空间 (可选)
          }}
          onPressEnter={e => !e.shiftKey && (e.preventDefault(), startBattle())}
        />
        <Button 
          type="primary"
          icon={<SquareArrowUp />}
          size="large"
          onClick={startBattle}
          loading={battleLoading}
          disabled={!prompt.trim()}
          style={{
            position: 'absolute',
            right: '5px',
            bottom: '5px',
          }}
        />
      </div>
      {battleError && <Alert message={battleError} type="error" closable onClose={() => setBattleError(null)} style={{ marginBottom: 16 }} />}

      {battleLoading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="模型正在生成回应..." />
        </div>
      )}

      {results.length > 0 && (
        <Row gutter={16}>
          {/* ... (结果展示的 Card 组件保持不变) ... */}
        </Row>
      )}

      <ChatDialog 
        visible={chatVisible} 
        onClose={() => setChatVisible(false)} 
        model={selectedModelForChat} 
      />
    </>
  );
}