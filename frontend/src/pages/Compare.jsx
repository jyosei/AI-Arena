import React, { useState } from 'react';
import { Card, Select, Button, Row, Col } from 'antd';
import { compareModels } from '../api/models';

export default function Compare() {
  const [leftId, setLeftId] = useState(null);
  const [rightId, setRightId] = useState(null);
  const [result, setResult] = useState(null);

  const handleCompare = async () => {
    if (!leftId || !rightId) return;
    const res = await compareModels([leftId, rightId]);
    setResult(res.data);
  };

  // For demo: simple id selectors. In real app we'd fetch list
  const sampleOptions = [
    { label: '模型 1', value: 1 },
    { label: '模型 2', value: 2 },
    { label: '模型 3', value: 3 },
  ];

  return (
    <Card title="模型对比">
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Select
            placeholder="左侧模型"
            options={sampleOptions}
            style={{ width: '100%' }}
            onChange={setLeftId}
          />
        </Col>
        <Col span={6}>
          <Select
            placeholder="右侧模型"
            options={sampleOptions}
            style={{ width: '100%' }}
            onChange={setRightId}
          />
        </Col>
        <Col span={4}>
          <Button type="primary" onClick={handleCompare}>对比</Button>
        </Col>
      </Row>
      {result && (
        <div>
          <h3>对比结果</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </Card>
  );
}
