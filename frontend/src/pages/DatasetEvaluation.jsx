import React, { useState, useEffect } from 'react';
import { Select, Button, Table, message, Spin, Typography, Alert, Card, Row, Col, Tag, Space } from 'antd';
import { HddOutlined, DownloadOutlined, HeartOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useMode } from '../contexts/ModeContext';
import request from '../api/request';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const modalityColors = {
  text: 'blue',
  image: 'purple',
  audio: 'green',
  robotics: 'orange',
  synthetic: 'cyan',
  multimodal: 'gold',
  default: 'default',
};

const DatasetCard = ({ dataset, isSelected, onSelect }) => {
  const color = modalityColors[dataset.modality] || modalityColors.default;
  
  return (
    <Card 
      hoverable 
      style={{ 
        width: '100%', 
        borderRadius: '8px', 
        border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
        position: 'relative',
      }}
      onClick={() => onSelect(dataset.id)}
    >
      {isSelected && (
        <CheckCircleFilled 
          style={{ 
            position: 'absolute', 
            top: 10, 
            right: 10, 
            color: '#1890ff',
            fontSize: '20px'
          }} 
        />
      )}
      <Title level={5} style={{ marginTop: 0, marginBottom: '8px' }}>
        <HddOutlined style={{ marginRight: 8, color: '#595959' }} />
        {dataset.id}
      </Title>
      <Paragraph style={{ marginBottom: '16px' }}>
        <Tag color={color}>{dataset.modality.toUpperCase()}</Tag>
      </Paragraph>
      <Space size="middle" style={{ color: '#8c8c8c' }}>
        <span>
          <DownloadOutlined style={{ marginRight: 4 }} />
          {dataset.downloads}
        </span>
        <span>
          <HeartOutlined style={{ marginRight: 4 }} />
          {dataset.likes}
        </span>
      </Space>
    </Card>
  );
};

export default function DatasetEvaluationPage() {
  const { models } = useMode();
  const [availableDatasets, setAvailableDatasets] = useState([]); // 存储可用的数据集列表
  const [selectedDataset, setSelectedDataset] = useState(null); // 存储用户选择的数据集
  const [selectedModel, setSelectedModel] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(true); // 加载数据集列表的状态

  // 在组件加载时获取数据集列表
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setLoadingDatasets(true);
        const response = await request.get('/models/datasets/');
        setAvailableDatasets(response.data);
      } catch (error) {
        message.error('加载可用数据集列表失败');
      } finally {
        setLoadingDatasets(false);
      }
    };
    fetchDatasets();
  }, []);

  const handleStartEvaluation = async () => {
    if (!selectedDataset) {
      message.error('请选择一个数据集');
      return;
    }
    if (!selectedModel) {
      message.error('请选择一个要测评的模型');
      return;
    }

    setLoading(true);
    setResults([]);

    // 准备要发送的 JSON 数据
    const payload = {
      dataset_name: selectedDataset,
      model_name: selectedModel,
    };

    try {
      // 发送 application/json 请求
      const response = await request.post('/models/evaluate-dataset/', payload);
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
      
      {/* 测评操作区域 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Text strong>选择模型:</Text>
          <Select
            style={{ width: 250 }}
            placeholder="选择要测评的模型"
            onChange={(value) => setSelectedModel(value)}
            allowClear
          >
            {models.map(m => <Option key={m.id} value={m.name}>{m.name}</Option>)}
          </Select>
          <Button type="primary" onClick={handleStartEvaluation} loading={loading} disabled={!selectedDataset || !selectedModel}>
            开始测评
          </Button>
        </div>
        {selectedDataset && <Alert message={`已选择数据集: ${selectedDataset}`} type="info" showIcon style={{ marginTop: 16 }}/>}
      </Card>

      {/* 数据集展示和选择区域 */}
      <Title level={3}>选择一个数据集</Title>
      {loadingDatasets ? (
        <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {availableDatasets.map(dataset => (
            <Col key={dataset.id} xs={24} sm={12} md={12} lg={8} xl={6}>
              <DatasetCard 
                dataset={dataset} 
                isSelected={selectedDataset === dataset.id}
                onSelect={setSelectedDataset}
              />
            </Col>
          ))}
        </Row>
      )}
      
      {/* 测评结果展示区域 */}
      {loading && <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}
      
      {results.length > 0 && (
        <>
          <Title level={3}>测评结果</Title>
          <Table
            columns={columns}
            dataSource={results.map((r, i) => ({ ...r, key: i }))}
            bordered
            pagination={{ pageSize: 10 }}
          />
        </>
      )}
    </div>
  );
}