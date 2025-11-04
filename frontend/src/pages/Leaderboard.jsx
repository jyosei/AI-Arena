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
      setRows(res.data || []);
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
