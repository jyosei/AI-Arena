import React, { useEffect, useState } from 'react';
import { Card, Input, Select, List, Button, Spin } from 'antd';
import { Link } from 'react-router-dom';
import { getModels } from '../api/models';

const { Search } = Input;

export default function ModelList() {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getModels({ search: query, type: filter === 'all' ? undefined : filter });
      setModels(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <Card title="模型库">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Search placeholder="搜索模型" onSearch={(v) => { setQuery(v); fetch(); }} style={{ flex: 1 }} />
        <Select value={filter} onChange={(v) => { setFilter(v); }} style={{ width: 160 }}>
          <Select.Option value="all">全部</Select.Option>
          <Select.Option value="classification">分类</Select.Option>
          <Select.Option value="detection">检测</Select.Option>
        </Select>
        <Button onClick={fetch}>筛选</Button>
      </div>
      {loading ? <Spin /> : (
        <List
          grid={{ gutter: 16, column: 3 }}
          dataSource={models}
          renderItem={(item) => (
            <List.Item>
              <Card title={item.name} size="small">
                <p>作者: {item.owner_name || '-'}</p>
                <p>任务: {item.task || '-'}</p>
                <Link to={`/models/${item.id}`}>查看详情</Link>
              </Card>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
