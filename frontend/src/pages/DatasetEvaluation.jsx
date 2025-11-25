import React, { useState } from 'react';
import { Upload, Button, Select, Table, message, Spin, Typography, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useMode } from '../contexts/ModeContext';
import request from '../api/request';

const { Title, Text } = Typography;
const { Option } = Select;

export default function DatasetEvaluationPage() {
  const { models } = useMode();
  const [file, setFile] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (info) => {
    // 只保留最后一个文件
    setFile(info.fileList.slice(-1)[0]?.originFileObj || null);
  };

  const handleStartEvaluation = async () => {
    if (!file) {
      message.error('请先上传一个 CSV 数据集文件');
      return;
    }
    if (!selectedModel) {
      message.error('请选择一个要测评的模型');
      return;
    }

    setLoading(true);
    setResults([]);

    const formData = new FormData();
    formData.append('dataset', file);
    formData.append('model_name', selectedModel);

    try {
      const response = await request.post('/models/evaluate-dataset/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResults(response.data);
      message.success('测评完成！');
    } catch (error) {
      const errorMsg = error.response?.data?.error || '测评过程中发生未知错误';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '问题 (Prompt)', dataIndex: 'prompt', key: 'prompt', width: '30%' },
    { title: '模型回答 (Response)', dataIndex: 'response', key: 'response', width: '60%' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      width: '10%',
      render: (status) => <Text type={status === 'error' ? 'danger' : 'success'}>{status}</Text>
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>数据集批量测评</Title>
      <Alert
        message="请上传一个 UTF-8 编码的 CSV 文件，其中必须包含一个名为 'prompt' 的列。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <Upload beforeUpload={() => false} onChange={handleFileChange} maxCount={1}>
          <Button icon={<UploadOutlined />}>选择 CSV 文件</Button>
        </Upload>
        <Select
          style={{ width: 250 }}
          placeholder="选择要测评的模型"
          onChange={(value) => setSelectedModel(value)}
          allowClear
        >
          {models.map(m => <Option key={m.id} value={m.name}>{m.name}</Option>)}
        </Select>
        <Button type="primary" onClick={handleStartEvaluation} loading={loading} disabled={!file || !selectedModel}>
          开始测评
        </Button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}
      
      {results.length > 0 && (
        <Table
          columns={columns}
          dataSource={results.map((r, i) => ({ ...r, key: i }))}
          bordered
          pagination={{ pageSize: 10 }}
        />
      )}
    </div>
  );
}