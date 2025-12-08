import React, { useState, useEffect } from 'react';
import { Table, Spin, Alert, Typography, Tag, Space } from 'antd';
import { MessageOutlined, LinkOutlined } from '@ant-design/icons';
import request from '../api/request';

const { Title, Text } = Typography;

// 根据分数返回条形图的颜色
const getBarColor = (score) => {
  if (score > 80) return '#52c41a'; // 优异 (绿色)
  if (score > 50) return '#1890ff'; // 良好 (蓝色)
  if (score > 30) return '#faad14'; // 一般 (橙色)
  return '#f5222d'; // 较差 (红色)
};

export default function BenchmarkLeaderboard() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBenchmarkScores = async () => {
      try {
        setLoading(true);
        const response = await request.get('models/benchmark-scores/');
        const dataWithKeys = response.data.map(item => ({ ...item, key: item.rank }));
        setScores(dataWithKeys);
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

  // 动态生成评测维度的列
  const benchmarkColumns = scores.length > 0
    ? Object.keys(scores[0].scores).map(category => ({
        title: category.toUpperCase(),
        dataIndex: ['scores', category],
        key: category,
        align: 'center',
        width: 150, // 给定一个固定宽度以获得更好的视觉效果
        sorter: (a, b) => a.scores[category] - b.scores[category],
        render: (score) => {
          if (score === null || typeof score === 'undefined') {
            return <Text type="secondary">N/A</Text>;
          }
          const scoreValue = score.toFixed(2);
          return (
            // 容器 div，用于相对定位
            <div style={{ position: 'relative', height: '24px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
              {/* 颜色条 div，宽度根据分数变化 */}
              <div style={{
                width: `${scoreValue}%`,
                height: '100%',
                backgroundColor: getBarColor(score),
                position: 'absolute',
                left: 0,
                top: 0,
                transition: 'width 0.3s ease-in-out',
              }} />
              {/* 分数文本 div，绝对定位以居中 */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
                fontWeight: 'bold',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)', // 给文本加一点阴影使其更清晰
              }}>
                {scoreValue}%
              </div>
            </div>
          );
        },
      }))
    : [];

  const columns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      align: 'center',
      sorter: (a, b) => a.rank - b.rank,
    },
    {
      title: 'Type',
      key: 'type',
      align: 'center',
      render: () => <MessageOutlined style={{ color: '#9c88ff' }} />,
    },
    {
      title: 'Model',
      dataIndex: 'model_name',
      key: 'model_name',
      render: (text) => (
        <a href="#" onClick={(e) => e.preventDefault()}>
          {text} <LinkOutlined />
        </a>
      ),
    },
    {
      title: 'Average',
      dataIndex: 'total_score',
      key: 'total_score',
      align: 'center',
      width: 150, // 同样设置宽度
      sorter: (a, b) => a.total_score - b.total_score,
      render: (score) => { // <-- 使用与其他分数相同的渲染逻辑
        if (score === null || typeof score === 'undefined') {
          return <Text type="secondary">N/A</Text>;
        }
        const scoreValue = score.toFixed(2);
        return (
          <div style={{ position: 'relative', height: '24px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${scoreValue}%`,
              height: '100%',
              backgroundColor: getBarColor(score),
              position: 'absolute',
              left: 0,
              top: 0,
              transition: 'width 0.3s ease-in-out',
            }} />
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            }}>
              {scoreValue}%
            </div>
          </div>
        );
      },
    },
    ...benchmarkColumns,
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
  }

  if (error) {
    return <Alert message="错误" description={error} type="error" showIcon />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>客观基准测评排行榜</Title>
      <Table
        columns={columns}
        dataSource={scores}
        bordered
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}