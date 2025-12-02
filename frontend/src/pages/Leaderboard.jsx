import React, { useEffect, useState } from 'react';
import { Card, Select, Table, Spin, Tag, Tooltip } from 'antd';
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
        name: item.name || item.display_name || item.model_name || item.id || `模型-${idx + 1}`,
        owner_name: item.owner_name || item.owner || '-',
        value: item.value ?? item.score ?? '-',
        elo: item.elo_rating ?? '-',
        win_rate: item.win_rate !== undefined ? `${item.win_rate.toFixed(1)}%` : '-',
        battles: item.total_battles ?? 0,
        task: item.task_type || item.task || '-',
      }));

      setRows(mapped);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [metric]);

  const columns = [
    { title: '排名', dataIndex: 'rank', key: 'rank', width: 80, sorter: (a,b)=>a.rank-b.rank, align: 'center' },
    { title: '模型', dataIndex: 'name', key: 'name', ellipsis: true, render: (text,row) => <span>{text} {row.task !== '-' && <Tag color="blue" style={{marginLeft:4}}>{row.task}</Tag>}</span> },
    { title: '作者', dataIndex: 'owner_name', key: 'owner', width: 160, ellipsis: true },
    { title: 'ELO', dataIndex: 'elo', key: 'elo', align: 'right', sorter: (a,b)=> (a.elo=== '-'?0:a.elo) - (b.elo==='-'?0:b.elo) },
    { title: '胜率', dataIndex: 'win_rate', key: 'win_rate', align: 'right', sorter: (a,b)=> parseFloat(a.win_rate)-parseFloat(b.win_rate) },
    { title: '对战数', dataIndex: 'battles', key: 'battles', align: 'right', sorter: (a,b)=> a.battles - b.battles },
    { title: metric, dataIndex: 'value', key: 'value', align: 'right', render: (val)=> <Tooltip title={`当前指标：${metric}`}>{val}</Tooltip>, sorter: (a,b)=> {
        const av = isNaN(a.value)?0:Number(a.value);
        const bv = isNaN(b.value)?0:Number(b.value);
        return av - bv;
      } },
  ];

  return (
    <div className="container">
      <Card
        title="排行榜"
        extra={<span style={{fontSize:12,color:'#888'}}>数据来源：实时 ELO + 胜率统计</span>}
        bordered
      >
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <Select size="middle" value={metric} onChange={(v) => setMetric(v)} style={{ width: 200 }}>
            <Select.Option value="score">综合得分</Select.Option>
            <Select.Option value="accuracy">准确率</Select.Option>
            <Select.Option value="f1">F1</Select.Option>
          </Select>
        </div>
        <Table
          dataSource={rows}
          columns={columns}
          rowKey={(r) => r.id}
          size="middle"
          scroll={{ x: 800 }}
          loading={loading}
        />
      </Card>
    </div>
  );
}
