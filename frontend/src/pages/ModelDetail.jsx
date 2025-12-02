import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Spin, Descriptions, Tag, Space, Typography } from 'antd';
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
    <div className="container">
      <Card title={`模型详情：${model.name}`} bordered>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="名称">{model.name}</Descriptions.Item>
            <Descriptions.Item label="作者">{model.owner_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="描述">
              <Typography.Paragraph style={{ margin: 0 }}>{model.description || '-'}</Typography.Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="任务">{model.task || '-'}</Descriptions.Item>
            <Descriptions.Item label="指标">
              {model.metrics && Object.keys(model.metrics).length > 0 ? (
                <Space wrap>
                  {Object.entries(model.metrics).map(([k, v]) => (
                    <Tag key={k} color="blue">{k}: {String(v)}</Tag>
                  ))}
                </Space>
              ) : (
                '-' 
              )}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>
    </div>
  );
}
