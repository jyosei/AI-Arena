import React, { useState, useEffect } from 'react';
import { Table, Spin, Alert, Typography, Tag } from 'antd';
import request from '../api/request'; // 你的 API 请求工具

const { Title, Paragraph } = Typography;

const categoryColors = {
  '综合知识': 'blue',
  '代码能力': 'green',
  '数学推理': 'orange',
  '常识问答': 'purple',
};

export default function BenchmarkLeaderboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBenchmarkScores = async () => {
      try {
        setLoading(true);
        // 假设后端提供了这个 API 端点
        const response = await request.get('models/benchmark-scores/');
        // 假设返回的数据格式为: [{ model_name: '...', total_score: 95.5, scores: { '代码能力': 98.0, ... } }, ...]
        setScores(response.data);
        setError(null);
      } catch (err) {
        setError('无法加载客观基准测评数据，请稍后再试。');
        console.error('Failed to fetch benchmark scores:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarkScores();
  }, []);

  // 动态生成列，基于第一个模型的评测维度
  const scoreColumns = scores.length > 0 
    ? Object.keys(scores[0].scores).map(category => ({
        title: category,
        dataIndex: ['scores', category],
        key: category,
        align: 'center',
        sorter: (a, b) => a.scores[category] - b.scores[category],
        render: (score) => <Tag color={categoryColors[category] || 'default'}>{score?.toFixed(1) || 'N/A'}</Tag>,
      }))
    : [];

  const columns = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      align: 'center',
      render: (text, record, index) => <strong>{index + 1}</strong>,
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      key: 'model_name',
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      align: 'center',
      sorter: (a, b) => a.total_score - b.total_score,
      defaultSortOrder: 'descend',
      render: (score) => <strong style={{ color: '#1890ff' }}>{score?.toFixed(2)}</strong>,
    },
    ...scoreColumns, // 动态插入各个维度的分数
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <Title level={2}>客观基准测评排行榜</Title>
      <Paragraph type="secondary">
        该排行榜通过在精选的标准化测试集（如代码生成、数学推理等）上自动运行模型得出。分数会定期更新。
      </Paragraph>
      
      {loading && <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}
      
      {error && <Alert message={error} type="error" showIcon />}

      {!loading && !error && (
        <Table
          dataSource={scores}
          columns={columns}
          rowKey="model_name"
          pagination={{ pageSize: 15 }}
        />
      )}
    </div>
  );
}