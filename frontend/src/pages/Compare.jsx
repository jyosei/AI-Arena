import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Row, Col, Input, Typography, Spin, Alert, Dropdown, Space, Menu, message } from 'antd';
import { LikeOutlined, DislikeOutlined, SwapOutlined, MehOutlined, TableOutlined, ThunderboltOutlined, MessageOutlined, DownOutlined } from '@ant-design/icons';
import { battleModels, recordVote } from '../api/models';
import { useChat } from '../contexts/ChatContext';

const { TextArea } = Input;
const { Paragraph } = Typography;

export default function Compare() {
  // --- 核心修复：正确定义所有 state ---
  const [leftModel, setLeftModel] = useState(null); // 定义 leftModel 和 setLeftModel
  const [rightModel, setRightModel] = useState(null); // 定义 rightModel 和 setRightModel
  const [results, setResults] = useState([]); // 修复：你之前写的是 setResult
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [voted, setVoted] = useState(false);
  const [mode, setMode] = useState('side-by-side'); 
  const modelOptions = [
    { label: 'GPT-3.5-Turbo', value: 'gpt-3.5-turbo' },
    { label: 'GLM-4', value: 'glm-4' },
    { label: 'DeepSeek-Chat', value: 'deepseek-chat' },
    { label: 'Qwen-Max', value: 'qwen-max' },
  ];

  const { addChat } = useChat();

  const startBattle = async (isSideBySide) => {
    if (!prompt.trim()) {
      setError("请输入提示内容。");
      return;
    }
    if (mode !== 'direct-chat' && (!leftModel || !rightModel)) {
      setError("请选择模型。");
      return;
    }
    if (mode === 'direct-chat' && !leftModel) {
      setError("请选择一个模型进行对话。");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setVoted(false);

    try {
      const response = await battleModels({
        prompt,
        modelA: leftModel,
        modelB: rightModel,
        isDirectChat: mode === 'direct-chat'
      });
      setResults(response.data.results);
      setIsAnonymous(response.data.is_anonymous);

      // 将对话添加到历史记录
      const chatTitle = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
      const selectedModel = mode === 'direct-chat' ? leftModel : `${leftModel} vs ${rightModel}`;
      addChat(`[${selectedModel}] ${chatTitle}`);
    } catch (err) {
      setError(err.response?.data?.error || "请求失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (voteType) => {
    // 从 results 中获取模型名称
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

  // --- 新增：模式选择的菜单项 ---
  const menuItems = [
    {
      key: 'battle',
      label: 'Battle',
      icon: <ThunderboltOutlined />,
    },
    {
      key: 'side-by-side',
      label: 'Side by Side',
      icon: <TableOutlined />,
    },
    {
      key: 'direct-chat',
      label: 'Direct Chat',
      icon: <MessageOutlined />,
    },
  ];

  const handleMenuClick = (e) => {
    setMode(e.key);
    // 切换模式时清空已选模型和结果，以避免混淆
    setLeftModel(null);
    setRightModel(null);
    setResults([]);
  };

  const menu = (
    <Menu onClick={handleMenuClick} items={menuItems} />
  );

  // --- 新增：根据模式获取当前模式的标签 ---
  const currentModeLabel = menuItems.find(item => item.key === mode)?.label || 'Select Mode';

  return (
    <div>
      {/* --- 核心修改：新的模式选择和模型选择 UI --- */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space wrap size="large">
            <Dropdown overlay={menu}>
              <Button size="large">
                {currentModeLabel} <DownOutlined />
              </Button>
            </Dropdown>

            {/* 左侧模型选择框 (所有模式都需要) */}
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

            {/* 条件渲染：只有在非 Direct Chat 模式下才显示 "VS" 和右侧模型选择框 */}
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

      {/* --- 以下是现有 UI，基本保持不变 --- */}
      <TextArea
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="输入你的提示词，然后点击 '开始对战'..."
        style={{ marginBottom: 16 }}
      />
      
      <Button 
        type="primary" 
        size="large"
        onClick={() => startBattle(mode === 'side-by-side')} 
        loading={loading}
        style={{ marginBottom: 24 }}
      >
        {mode === 'direct-chat' ? '开始对话' : '开始对战'}
      </Button>

      {error && <Alert message={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      {/* 结果展示区域 (可以根据模式调整，这里暂时保持通用) */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="模型正在生成回应..." />
        </div>
      )}

      {results.length > 0 && (
        <Row gutter={16}>
          {results.map((result, index) => (
            <Col span={mode === 'side-by-side' ? 12 : 24} key={index}>
              <Card 
                title={
                  <Space>
                    {result.model}
                    {!isAnonymous && (
                      <Typography.Text type="secondary">
                        得分: {result.score}
                      </Typography.Text>
                    )}
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Paragraph
                  style={{ 
                    whiteSpace: 'pre-wrap',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}
                >
                  {result.response}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {results.length > 0 && mode !== 'direct-chat' && !voted && (
        <Row justify="center" style={{ marginTop: 24 }}>
          <Space size="large">
            <Button 
              icon={<LikeOutlined />} 
              onClick={() => handleVote('left')}
            >
              左侧更好
            </Button>
            <Button 
              icon={<SwapOutlined />} 
              onClick={() => handleVote('tie')}
            >
              不相上下
            </Button>
            <Button 
              icon={<LikeOutlined />} 
              onClick={() => handleVote('right')}
            >
              右侧更好
            </Button>
            <Button 
              icon={<DislikeOutlined />} 
              onClick={() => handleVote('both_bad')}
            >
              都不满意
            </Button>
          </Space>
        </Row>
      )}
    </div>
  );
}