import React, { useState, useEffect } from 'react';
import { Select, Button, Table, message, Spin, Typography, Alert, Card, Row, Col, Tag, Space, Statistic, Input, Modal } from 'antd';
import { HddOutlined, DownloadOutlined, HeartOutlined, CheckCircleFilled, EyeOutlined } from '@ant-design/icons';
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

// --- 优化版：数据集预览模态框组件 ---
const DatasetPreviewModal = ({ filename, visible, onClose }) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !filename) {
      // 关闭时重置数据，避免闪烁
      if (!visible) setPreviewData(null);
      return;
    }

    const fetchPreviewData = async () => {
      setLoading(true);
      try {
        const response = await request.get(`/models/datasets/preview/${filename}/`);
        setPreviewData(response.data);
      } catch (err) {
        message.error('无法加载数据集预览。');
        console.error('Error fetching dataset preview:', err);
        onClose(); // 出错时自动关闭
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [visible, filename, onClose]);

  // 动态计算列配置
  const columns = previewData?.headers.map(header => ({
    title: header,
    dataIndex: header,
    key: header,
    width: 200, // 为每列设置一个基础宽度
    ellipsis: true, // 内容过长时显示省略号
  })) || [];

  return (
    <Modal
      title={`预览: ${filename}`}
      visible={visible}
      onCancel={onClose}
      footer={null}
      width="80vw" // 模态框宽度
      destroyOnClose
    >
      <Spin spinning={loading}>
        {previewData && (
          <Table
            columns={columns}
            dataSource={previewData.rows.map((row, index) => ({ ...row, key: index }))}
            bordered
            pagination={false}
            // 关键改动：
            // 1. tableLayout: 'fixed' 强制表格使用固定布局
            // 2. scroll.x: '100%' 让表格内容宽度等于容器宽度，配合列宽实现缩略
            tableLayout="fixed"
            scroll={{ x: '100%' }} 
          />
        )}
      </Spin>
    </Modal>
  );
};

// --- 修改：数据集卡片组件，增加预览按钮 ---
const DatasetCard = ({ dataset, isSelected, onSelect, onPreview }) => {
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
      onClick={() => onSelect(dataset)}
      actions={[ // 在卡片底部添加操作按钮
        <EyeOutlined key="preview" onClick={(e) => {
          e.stopPropagation(); // 阻止事件冒泡到 Card 的 onClick
          onPreview(dataset.filename);
        }} />,
      ]}
    >
      {isSelected && (
        <CheckCircleFilled 
          style={{ position: 'absolute', top: 10, right: 10, color: '#1890ff', fontSize: '20px' }} 
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
        <span><DownloadOutlined style={{ marginRight: 4 }} />{dataset.downloads}</span>
        <span><HeartOutlined style={{ marginRight: 4 }} />{dataset.likes}</span>
      </Space>
    </Card>
  );
};

export default function DatasetEvaluationPage() {
  const { models } = useMode();
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null); 
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [userApiKey, setUserApiKey] = useState(localStorage.getItem('user_api_key') || '');

  // --- 新增：控制预览模态框的状态 ---
  const [previewingFile, setPreviewingFile] = useState(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

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

  // --- 新增：处理预览的函数 ---
  const handlePreview = (filename) => {
    setPreviewingFile(filename);
    setIsPreviewModalVisible(true);
  };

  const handleClosePreview = () => {
    setIsPreviewModalVisible(false);
    setPreviewingFile(null);
  };

  const handleApiKeyChange = (e) => {
    const key = e.target.value;
    setUserApiKey(key);
    localStorage.setItem('user_api_key', key);
  };

  const handleStartEvaluation = async () => {
    if (!selectedDataset) {
      message.error('请选择一个数据集');
      return;
    }
    if (!selectedModel) {
      message.error('请选择一个要测评的模型');
      return;
    }
    if (!userApiKey.startsWith('sk-') && !userApiKey.startsWith('deepseek')) {
      message.error('请输入一个有效的API Key！');
      return;
    }

    setLoading(true);
    setBenchmarkResult(null);

    const payload = {
      dataset_name: selectedDataset.filename,
      model_name: selectedModel,
      api_key: userApiKey,
    };

    try {
      const response = await request.post('/models/evaluate-dataset/', payload);
      setBenchmarkResult(response.data);
      message.success('测评完成！');
    } catch (error) {
      const errorMsg = error.response?.data?.error || '测评过程中发生未知错误';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderBenchmarkResults = () => {
    if (!benchmarkResult) return null;

    const { metrics, benchmark_type, error_samples } = benchmarkResult;

    const errorColumns = [
      { title: '问题 (Prompt)', dataIndex: 'prompt', key: 'prompt', width: '40%' },
      { title: '预期答案 (Expected)', dataIndex: 'expected_answer', key: 'expected_answer', width: '20%' },
      { title: '模型回答 (Response)', dataIndex: 'model_response', key: 'model_response', width: '40%' },
    ];

    return (
      <Card title="Benchmark 测评结果" style={{ marginTop: 24 }}>
        <Row gutter={[16, 24]}>
          <Col span={24}>
            <Text strong>测评任务类型: </Text>
            <Text>{benchmark_type}</Text>
          </Col>
          
          {Object.entries(metrics).map(([key, value]) => (
            <Col xs={12} sm={8} md={6} key={key}>
              <Statistic title={key.replace('_', ' ').toUpperCase()} value={value} suffix="%" />
            </Col>
          ))}
        </Row>

        {error_samples && error_samples.length > 0 && (
          <>
            <Title level={4} style={{ marginTop: 32, marginBottom: 16 }}>部分错误案例分析</Title>
            <Table
              columns={errorColumns}
              dataSource={error_samples.map((r, i) => ({ ...r, key: i }))}
              bordered
              pagination={false}
              scroll={{ x: 800 }}
            />
          </>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>数据集批量测评</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>您的API Key:</Text>
          <Input
            style={{ width: 400, marginLeft: 8 }}
            placeholder="请输入您的 API Key (sk-...)"
            value={userApiKey}
            onChange={handleApiKeyChange}
            type="password"
          />
        </div>
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
        {selectedDataset && <Alert message={`已选择数据集: ${selectedDataset.id}`} type="info" showIcon style={{ marginTop: 16 }}/>}
      </Card>

      <Title level={3}>选择一个数据集</Title>
      {loadingDatasets ? (
        <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {availableDatasets.map(dataset => (
            <Col key={dataset.id} xs={24} sm={12} md={12} lg={8} xl={6}>
              <DatasetCard 
                dataset={dataset} 
                isSelected={selectedDataset?.id === dataset.id}
                onSelect={setSelectedDataset}
                onPreview={handlePreview} // 传递预览处理函数
              />
            </Col>
          ))}
        </Row>
      )}
      
      {loading && <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}
      
      {renderBenchmarkResults()}

      {/* --- 新增：渲染预览模态框 --- */}
      <DatasetPreviewModal
        filename={previewingFile}
        visible={isPreviewModalVisible}
        onClose={handleClosePreview}
      />
    </div>
  );
}