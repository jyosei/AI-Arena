import React, { useEffect, useState } from 'react';
import { Card, Select, Table, Spin } from 'antd';
import { getLeaderboard } from '../api/models';

export default function Leaderboard() {
  const [metric, setMetric] = useState('score');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getLeaderboard(metric);
      const data = res.data || [];

      // 后端当前返回的 /models/ 接口没有 "rank" 和 "value" 字段，
      // 为了兼容并避免页面报错，这里做一次映射：
      // - 如果后端已经返回了 value 字段（例如真实 leaderboard），直接使用
      // - 否则把模型列表当作占位数据，构造 rank 和 value（value 用 '-' 占位）
      const mapped = data.map((item, idx) => ({
        id: item.id ?? idx,
        rank: item.rank ?? idx + 1,
        name: item.name || item.model_name || item.id || `模型-${idx + 1}`,
        owner_name: item.owner_name || item.owner || '-',
        value: item.value ?? item.score ?? '-',
      }));

      setRows(mapped);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [metric]);

  const columns = [
    { title: '排名', dataIndex: 'rank', key: 'rank' },
    { title: '模型', dataIndex: 'name', key: 'name' },
    { title: '作者', dataIndex: 'owner_name', key: 'owner' },
    { title: metric, dataIndex: 'value', key: 'value' },
  ];

  return (
    <Card title="排行榜">
      <div style={{ marginBottom: 12 }}>
        <Select value={metric} onChange={(v) => setMetric(v)} style={{ width: 200 }}>
          <Select.Option value="score">综合得分</Select.Option>
          <Select.Option value="accuracy">准确率</Select.Option>
          <Select.Option value="f1">F1</Select.Option>
        </Select>
      </div>
      {loading ? <Spin /> : <Table dataSource={rows} columns={columns} rowKey={(r) => r.id} />}
    </Card>
  );
}
