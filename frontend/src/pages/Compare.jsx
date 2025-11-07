import React, { useState } from 'react';
// 1. 确保从 antd 导入所有需要的组件
import { Card, Select, Button, Row, Col, Input, Typography, Spin, Alert, Space, message } from 'antd';
import { LikeOutlined, DislikeOutlined, SwapOutlined, MehOutlined } from '@ant-design/icons';
// 2. 确保导入了 recordVote
import { battleModels, recordVote } from '../api/models';

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

  const modelOptions = [
    { label: 'GPT-3.5-Turbo', value: 'gpt-3.5-turbo' },
    { label: 'GLM-4', value: 'glm-4' },
    { label: 'DeepSeek-Chat', value: 'deepseek-chat' },
    { label: 'Qwen-Max', value: 'qwen-max' },
  ];

  const startBattle = async (isSideBySide) => {
    if (!prompt.trim()) {
      setError("请输入提示内容。");
      return;
    }
    if (isSideBySide && (!leftModel || !rightModel)) {
      setError("请选择左右两个模型。");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setVoted(false); // 重置投票状态

    try {
      const payload = isSideBySide 
        ? { prompt, modelA: leftModel, modelB: rightModel }
        : { prompt };
      const response = await battleModels(payload);
      setResults(response.data.results);
      setIsAnonymous(response.data.is_anonymous);
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

  return (
    <Card title="模型对战竞技场">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <TextArea rows={4} placeholder="在这里输入你的提示或问题..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Col>
        <Col xs={24} sm={10}><Select placeholder="选择左侧模型" options={modelOptions} style={{ width: '100%' }} onChange={setLeftModel} value={leftModel} /></Col>
        <Col xs={24} sm={10}><Select placeholder="选择右侧模型" options={modelOptions} style={{ width: '100%' }} onChange={setRightModel} value={rightModel} /></Col>
        <Col xs={24} sm={4}><Button type="primary" onClick={() => startBattle(true)} block>对比</Button></Col>
        <Col span={24}><Button type="dashed" onClick={() => startBattle(false)} block>随机盲测</Button></Col>
      </Row>

      {loading && <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" tip="模型正在生成回复..." /></div>}
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
      
      {results.length > 0 && (
        <>
          {/* 结果展示 */}
          <Row gutter={16}>
            {results.map((result, index) => (
              <Col span={12} key={index}>
                <Card title={isAnonymous ? `模型 ${String.fromCharCode(65 + index)}` : result.model} style={{ height: '100%' }}>
                  <Paragraph style={{ whiteSpace: 'pre-wrap', minHeight: '150px' }}>{result.response}</Paragraph>
                </Card>
              </Col>
            ))}
          </Row>

          {/* 投票区域 */}
          <Row justify="center" style={{ marginTop: 24 }}>
            <Space size="large">
              <Button type="primary" icon={<LikeOutlined />} disabled={voted} onClick={() => handleVote('left')}>
                Left is better.
              </Button>
              <Button icon={<SwapOutlined />} disabled={voted} onClick={() => handleVote('tie')}>
                It's a tie.
              </Button>
              <Button danger icon={<MehOutlined />} disabled={voted} onClick={() => handleVote('both_bad')}>
                Both are bad.
              </Button>
              <Button type="primary" icon={<LikeOutlined style={{ transform: 'scaleX(-1)' }} />} disabled={voted} onClick={() => handleVote('right')}>
                Right is better.
              </Button>
            </Space>
          </Row>
        </>
      )}
    </Card>
  );
}