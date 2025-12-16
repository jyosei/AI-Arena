import React, { useState, useEffect, useContext } from 'react';
import { Select, Button, Table, message, Spin, Typography, Alert, Card, Row, Col, Tag, Space, Statistic, Input, Progress ,Modal} from 'antd';
import { HddOutlined, DownloadOutlined, HeartOutlined, CheckCircleFilled ,EyeOutlined} from '@ant-design/icons';
import { useMode } from '../contexts/ModeContext';
import AuthContext from '../contexts/AuthContext.jsx';
import request from '../api/request';
import { useNavigate } from 'react-router-dom';

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
  const { user, openLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [availableDatasets, setAvailableDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null); 
  const [selectedModel, setSelectedModel] = useState(null);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [userApiKey, setUserApiKey] = useState(localStorage.getItem('user_api_key') || '');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [progressState, setProgressState] = useState({ total: 0, completed: 0, elapsed: 0, metrics: {} });
  const [progressLogs, setProgressLogs] = useState([]);
  const [activeController, setActiveController] = useState(null);
  const [latestEvaluationId, setLatestEvaluationId] = useState(null);

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
    // 未登录提示并跳转登录
    if (!user) {
      message.info('请先登录后再进行数据集测评');
      if (typeof openLogin === 'function') openLogin();
      return;
    }
    if (isEvaluating) {
      message.warning('测评正在进行中');
      return;
    }
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

    setBenchmarkResult(null);
    setProgressLogs([]);
    setProgressState({ total: 0, completed: 0, elapsed: 0, metrics: {} });
    setLatestEvaluationId(null);

    const payload = {
      dataset_name: selectedDataset.filename,
      model_name: selectedModel,
      api_key: userApiKey,
    };

    const controller = new AbortController();
    setActiveController(controller);
    setIsEvaluating(true);

    const baseURL = (request.defaults && request.defaults.baseURL) ? request.defaults.baseURL : '/api/';
    const normalizedBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    const streamEndpoint = `${normalizedBaseURL}/models/evaluate-dataset/stream/`;

    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let summaryReceived = false;
    let errorFromStream = false;

    const processLine = (line) => {
      if (!line.trim()) {
        return;
      }

      let event;
      try {
        event = JSON.parse(line);
      } catch (parseError) {
        console.error('无法解析流式数据:', line);
        return;
      }

      if (event.type === 'init') {
        setProgressState(() => ({ total: event.total || 0, completed: 0, elapsed: 0, metrics: {} }));
        if (event.evaluation_id) {
          setLatestEvaluationId(event.evaluation_id);
        }
        return;
      }

      if (event.type === 'progress') {
        setProgressState((prev) => ({
          total: event.total ?? prev.total,
          completed: event.index ?? prev.completed,
          elapsed: typeof event.elapsed === 'number' ? event.elapsed : prev.elapsed,
          metrics: event.running_metrics ? event.running_metrics : prev.metrics,
        }));

        setProgressLogs((prev) => {
          const logEntry = {
            key: event.index ?? prev.length,
            index: event.index ?? prev.length,
            prompt: event.prompt || '',
            expected_answer: event.expected_answer || '',
            model_response: event.model_response || '',
            is_correct: Boolean(event.is_correct),
            sample_time: event.sample_time ?? null,
            included_in_metrics: event.included_in_metrics !== false,
            skipped: Boolean(event.skipped),
            message: event.message || '',
          };

          const next = [...prev, logEntry];
          if (next.length > 100) {
            next.shift();
          }
          return next;
        });
        return;
      }

      if (event.type === 'summary') {
        summaryReceived = true;
        const summary = event.result || {};
        setBenchmarkResult(summary);
        if (summary.evaluation_id) {
          setLatestEvaluationId(summary.evaluation_id);
        }
        setProgressState((prev) => ({
          total: summary.total_prompts ?? prev.total,
          completed: summary.total_prompts ?? prev.completed,
          elapsed: typeof summary.elapsed_seconds === 'number' ? summary.elapsed_seconds : prev.elapsed,
          metrics: summary.metrics || prev.metrics,
        }));
        return;
      }

      if (event.type === 'error') {
        errorFromStream = true;
        const errMsg = event.message || '测评过程中发生错误';
        message.error(errMsg);
      }
    };

    try {
      const response = await fetch(streamEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '测评请求失败');
      }

      const reader = response.body && response.body.getReader ? response.body.getReader() : null;
      if (!reader) {
        throw new Error('浏览器不支持流式响应');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(processLine);
      }

      buffer += decoder.decode();
      if (buffer) {
        processLine(buffer);
      }

      if (summaryReceived && !errorFromStream) {
        message.success('测评完成，结果已保存');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        message.info('测评已取消');
      } else if (!errorFromStream) {
        const fallbackMessage = error.message || '测评过程中发生未知错误';
        message.error(fallbackMessage);
      }
    } finally {
      setIsEvaluating(false);
      setActiveController(null);
    }
  };

  const handleCancelEvaluation = () => {
    if (activeController) {
      activeController.abort();
    }
  };

  const progressColumns = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 70,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        if (record.skipped) {
          return <Tag>跳过</Tag>;
        }
        if (!record.included_in_metrics) {
          return <Tag color="orange">异常</Tag>;
        }
        return record.is_correct ? <Tag color="green">正确</Tag> : <Tag color="red">错误</Tag>;
      },
    },
    {
      title: '提示词',
      dataIndex: 'prompt',
      key: 'prompt',
      ellipsis: true,
      render: (value) => <Text>{value || '--'}</Text>,
    },
    {
      title: '模型输出',
      dataIndex: 'model_response',
      key: 'model_response',
      ellipsis: true,
      render: (value) => <Text>{value || '--'}</Text>,
    },
    {
      title: '参考答案',
      dataIndex: 'expected_answer',
      key: 'expected_answer',
      ellipsis: true,
      render: (value) => <Text>{value || '--'}</Text>,
    },
    {
      title: '耗时 (s)',
      dataIndex: 'sample_time',
      key: 'sample_time',
      width: 100,
      render: (value) => (typeof value === 'number' ? value.toFixed(3) : '-'),
    },
    {
      title: '备注',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (value) => <Text type="secondary">{value || '--'}</Text>,
    },
  ];

  const renderProgressPanel = () => {
    const total = progressState.total || 0;
    const completed = progressState.completed || 0;
    const hasProgress = isEvaluating || completed > 0 || progressLogs.length > 0;
    if (!hasProgress) {
      return null;
    }

    const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    const metricsEntries = Object.entries(progressState.metrics || {});
    const elapsedNumeric = typeof progressState.elapsed === 'number' ? progressState.elapsed : 0;
    const evaluationId = latestEvaluationId;

    return (
      <Card title="实时测评进度" style={{ marginTop: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {evaluationId && (
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Text type="secondary">记录 ID: {evaluationId}</Text>
              <Button type="link" size="small" onClick={() => navigate(`/evaluate-dataset/history?highlight=${evaluationId}`)}>
                查看历史记录
              </Button>
            </Space>
          )}
          <Progress percent={percent} status={isEvaluating ? 'active' : 'normal'} />
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="已完成" value={completed} suffix={total ? ` / ${total}` : ''} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic title="累计耗时" value={Number(elapsedNumeric.toFixed(1))} suffix="s" />
            </Col>
            {metricsEntries.map(([key, value]) => (
              <Col xs={12} sm={8} md={6} key={key}>
                <Statistic title={key.replace('_', ' ').toUpperCase()} value={value || 0} suffix="%" />
              </Col>
            ))}
          </Row>
          <Table
            size="small"
            columns={progressColumns}
            dataSource={progressLogs}
            pagination={false}
            scroll={{ x: 960, y: 260 }}
          />
        </Space>
      </Card>
    );
  };

  const renderBenchmarkResults = () => {
    if (!benchmarkResult) return null;

    const {
      metrics = {},
      benchmark_type,
      error_samples,
      total_prompts,
      evaluated_prompts,
      correct_answers,
      elapsed_seconds,
      model_name,
      dataset_name,
      evaluation_id,
    } = benchmarkResult;

    const resolvedEvaluationId = evaluation_id || latestEvaluationId;
    const historyButton = resolvedEvaluationId ? (
      <Button type="link" onClick={() => navigate(`/evaluate-dataset/history?highlight=${resolvedEvaluationId}`)}>查看完整记录</Button>
    ) : null;

    const errorColumns = [
      { title: '问题 (Prompt)', dataIndex: 'prompt', key: 'prompt', width: '40%' },
      { title: '预期答案 (Expected)', dataIndex: 'expected_answer', key: 'expected_answer', width: '20%' },
      { title: '模型回答 (Response)', dataIndex: 'model_response', key: 'model_response', width: '40%' },
    ];

    const generalStats = [
      typeof total_prompts === 'number' ? { title: '总样本数', value: total_prompts } : null,
      typeof evaluated_prompts === 'number' ? { title: '已评估样本', value: evaluated_prompts } : null,
      typeof correct_answers === 'number' ? { title: '正确样本数', value: correct_answers } : null,
      typeof elapsed_seconds === 'number' ? { title: '总耗时 (s)', value: Number(elapsed_seconds.toFixed(1)) } : null,
    ].filter(Boolean);

    return (
      <Card title="Benchmark 测评结果" style={{ marginTop: 24 }} extra={historyButton}>
        <Row gutter={[16, 24]}>
          <Col span={24}>
            <Space size="large">
              {model_name && (
                <>
                  <Text strong>模型:</Text>
                  <Text>{model_name}</Text>
                </>
              )}
              {dataset_name && (
                <>
                  <Text strong>数据集:</Text>
                  <Text>{dataset_name}</Text>
                </>
              )}
            </Space>
          </Col>
          <Col span={24}>
            <Text strong>测评任务类型: </Text>
            <Text>{benchmark_type}</Text>
          </Col>

          {generalStats.map((item) => (
            <Col xs={12} sm={8} md={6} key={item.title}>
              <Statistic title={item.title} value={item.value} />
            </Col>
          ))}

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
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>您的API Key:</Text>
            <Input
              style={{ width: '100%', maxWidth: 400 }}
              placeholder="请输入您的 API Key (sk-...)"
              value={userApiKey}
              onChange={handleApiKeyChange}
              type="password"
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>选择模型:</Text>
            <Select
              style={{ width: '100%', maxWidth: 250 }}
              placeholder="选择要测评的模型"
              onChange={(value) => setSelectedModel(value)}
              allowClear
            >
              {models.map(m => <Option key={m.id} value={m.name}>{m.name}</Option>)}
            </Select>
          </div>
          <Space wrap>
            <Button
              type="primary"
              onClick={handleStartEvaluation}
              loading={isEvaluating}
              disabled={!selectedDataset || !selectedModel || isEvaluating}
            >
              {isEvaluating ? '测评进行中…' : '开始测评'}
            </Button>
            <Button danger onClick={handleCancelEvaluation} disabled={!isEvaluating}>
              取消
            </Button>
          </Space>
        </Space>
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
      
      {renderProgressPanel()}
      
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