import React, { useEffect, useState } from 'react';
import { 
  Input, Button, Spin, Modal, Typography, Row, Col, 
  Space, Avatar, Alert, message 
} from 'antd';
import { 
  RobotOutlined, UserOutlined, SendOutlined 
} from '@ant-design/icons';
import { useMode } from '../contexts/ModeContext';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

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

export default function ArenaPage() {
  const { mode, models, leftModel, rightModel, setLeftModel, setRightModel } = useMode();

  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState([]);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleError, setBattleError] = useState(null);
  const [voted, setVoted] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [selectedModelForChat, setSelectedModelForChat] = useState(null);

  useEffect(() => {
    setResults([]);
  }, [mode]);

  const startBattle = async () => {
    if (!prompt.trim()) {
      setBattleError("请输入提示内容。");
      return;
    }

    let modelA = leftModel;
    let modelB = rightModel;

    if (mode === 'battle') {
      if (models.length < 2) {
        setBattleError("模型数量不足，无法进行 Battle。");
        return;
      }
      const shuffled = [...models].sort(() => 0.5 - Math.random());
      modelA = shuffled[0].name;
      modelB = shuffled[1].name;
      setLeftModel(modelA);
      setRightModel(modelB);
    }

    if (mode === 'side-by-side' && (!modelA || !modelB)) {
      setBattleError("请在顶部选择左右两个模型。");
      return;
    }
    
    if (mode === 'direct-chat') {
        return;
    }

    setBattleLoading(true);

    try {
      const payload = { prompt, modelA, modelB };
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
      setVoted(true);
    } catch (err) {
      message.error('提交反馈失败，请稍后再试。');
    }
  };

  return (
    <>
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <TextArea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything..."
          style={{ 
            paddingRight: '50px',
            paddingBottom: '30px'
          }}
          onPressEnter={e => !e.shiftKey && (e.preventDefault(), startBattle())}
        />
        <Button 
          type="primary"
          icon={<SendOutlined />}
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