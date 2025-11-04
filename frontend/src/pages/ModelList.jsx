import React, { useEffect, useState } from 'react';
import { Card, Input, Select, List, Button, Spin, Modal } from 'antd';
import { Link } from 'react-router-dom';
import { getModels } from '../api/models';

const { Search } = Input;

export default function ModelList() {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getModels({ search: query, type: filter === 'all' ? undefined : filter });
      setModels(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetch(); 
    // 页面加载时显示欢迎对话框
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setWelcomeModalVisible(true);
      localStorage.setItem('hasSeenWelcome', 'true');
    }
  }, []);

  const handleWelcomeOk = () => {
    setWelcomeModalVisible(false);
  };

  const handleWelcomeCancel = () => {
    setWelcomeModalVisible(false);
  };

  return (
    <>
      <Card title="模型库">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Search 
            placeholder="搜索模型" 
            onSearch={(v) => { setQuery(v); fetch(); }} 
            style={{ flex: 1 }} 
          />
          <Select 
            value={filter} 
            onChange={(v) => { setFilter(v); }} 
            style={{ width: 160 }}
          >
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

      {/* 欢迎对话框 */}
      <Modal
        title="🎉 欢迎来到 AI Arena！"
        open={welcomeModalVisible}
        onOk={handleWelcomeOk}
        onCancel={handleWelcomeCancel}
        okText="开始探索"
        cancelText="稍后再说"
        width={600}
        maskClosable={false}
      >
        <div style={{ padding: '20px 0' }}>
          <h3>欢迎使用 AI 模型竞技场</h3>
          <p>在这里您可以：</p>
          <ul>
            <li>📚 浏览丰富的 AI 模型库</li>
            <li>🏆 查看模型在排行榜上的表现</li>
            <li>⚔️ 对比不同模型的性能</li>
            <li>👤 管理您自己的模型</li>
          </ul>
          <p style={{ marginTop: 16, color: '#666' }}>
            开始探索这个精彩的 AI 世界吧！
          </p>
        </div>
      </Modal>
    </>
  );
}