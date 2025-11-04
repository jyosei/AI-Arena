import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Spin, Descriptions } from 'antd';
import { getModel } from '../api/models';

export default function ModelDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getModel(id);
        setModel(res.data);
      } finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading || !model) return <Spin />;

  return (
    <Card title={`模型详情：${model.name}`}>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="名称">{model.name}</Descriptions.Item>
        <Descriptions.Item label="作者">{model.owner_name}</Descriptions.Item>
        <Descriptions.Item label="描述">{model.description}</Descriptions.Item>
        <Descriptions.Item label="任务">{model.task}</Descriptions.Item>
        <Descriptions.Item label="指标">{JSON.stringify(model.metrics || {})}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
