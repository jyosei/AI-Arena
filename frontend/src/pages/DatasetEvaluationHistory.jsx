import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Drawer,
  Descriptions,
  Tabs,
  message,
  Spin,
} from 'antd';
import { useSearchParams } from 'react-router-dom';
import { getDatasetEvaluations, getDatasetEvaluationDetail } from '../api/models';

const { Title, Text } = Typography;

const statusTag = (status) => {
  const mapping = {
    completed: { color: 'green', text: '已完成' },
    running: { color: 'blue', text: '进行中' },
    failed: { color: 'red', text: '失败' },
  };
  const config = mapping[status] || { color: 'default', text: status };
  return <Tag color={config.color}>{config.text}</Tag>;
};

const formatDateTime = (value) => {
  if (!value) return '--';
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
};

const useHighlightParam = () => {
  const [searchParams] = useSearchParams();
  const highlightParam = searchParams.get('highlight');
  return highlightParam ? Number(highlightParam) : null;
};

const DatasetEvaluationHistoryPage = () => {
  const highlightParam = useHighlightParam();
  const autoOpenRef = useRef(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [highlightedId, setHighlightedId] = useState(highlightParam);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(null);
  const [detailTab, setDetailTab] = useState('errors');
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPagination, setDetailPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  useEffect(() => {
    if (highlightParam) {
      setHighlightedId(highlightParam);
      autoOpenRef.current = false;
    }
  }, [highlightParam]);

  const fetchDetail = useCallback(async (evaluationId, tabKey = 'errors', page = 1, pageSize = 20) => {
    try {
      setDetailLoading(true);
      const offset = (page - 1) * pageSize;
      const params = { limit: pageSize, offset };
      if (tabKey === 'errors') {
        params.errors_only = 'true';
      }
      const response = await getDatasetEvaluationDetail(evaluationId, params);
      setDetailData(response.data);
      const { pagination: detailPage } = response.data;
      setDetailPagination({
        current: page,
        pageSize,
        total: detailPage?.total || 0,
        errorsOnly: detailPage?.errors_only || tabKey === 'errors',
      });
    } catch (error) {
      console.error('Failed to load evaluation detail', error);
      message.error('加载测评详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleOpenDetail = useCallback((evaluationId, tabKey = detailTab) => {
    setHighlightedId(evaluationId);
    setSelectedEvaluationId(evaluationId);
    setDetailTab(tabKey);
    setDrawerVisible(true);
    fetchDetail(evaluationId, tabKey, 1, detailPagination.pageSize);
  }, [detailPagination.pageSize, detailTab, fetchDetail]);

  const fetchHistory = useCallback(async (page = 1, pageSize = 10) => {
    try {
      setHistoryLoading(true);
      const offset = (page - 1) * pageSize;
      const response = await getDatasetEvaluations({ limit: pageSize, offset });
      const { results, count } = response.data;
      setHistoryData(results || []);
      setHistoryPagination({ current: page, pageSize, total: count || 0 });

      if (highlightParam && !autoOpenRef.current) {
        const exists = (results || []).some((item) => item.id === highlightParam);
        if (exists) {
          autoOpenRef.current = true;
          handleOpenDetail(highlightParam, 'errors');
        }
      }
    } catch (error) {
      console.error('Failed to load dataset evaluations', error);
      message.error('加载测评记录失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [highlightParam, handleOpenDetail]);

  useEffect(() => {
    fetchHistory(historyPagination.current, historyPagination.pageSize);
  }, [fetchHistory]);

  const handleTableChange = (pagination) => {
    fetchHistory(pagination.current, pagination.pageSize);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedEvaluationId(null);
    setDetailData(null);
    setDetailPagination((prev) => ({ ...prev, current: 1, total: 0 }));
  };

  const handleDetailTabChange = (key) => {
    setDetailTab(key);
    if (selectedEvaluationId) {
      fetchDetail(selectedEvaluationId, key, 1, detailPagination.pageSize);
    }
  };

  const handleDetailTableChange = (pagination) => {
    if (selectedEvaluationId) {
      fetchDetail(selectedEvaluationId, detailTab, pagination.current, pagination.pageSize);
    }
  };

  const summaryColumns = useMemo(() => ([
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value) => formatDateTime(value),
      width: 180,
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      key: 'model_name',
      width: 200,
    },
    {
      title: '数据集',
      dataIndex: 'dataset_name',
      key: 'dataset_name',
      width: 220,
    },
    {
      title: '任务类型',
      dataIndex: 'benchmark_type',
      key: 'benchmark_type',
      render: (value) => value || '--',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value) => statusTag(value),
      width: 120,
    },
    {
      title: '样本统计',
      key: 'samples',
      render: (_, record) => (
        <Space size={16}>
          <span>总数: {record.total_prompts || 0}</span>
          <span>已评估: {record.evaluated_prompts || 0}</span>
          <span>正确: {record.correct_answers || 0}</span>
        </Space>
      ),
    },
    {
      title: '耗时 (s)',
      dataIndex: 'elapsed_seconds',
      key: 'elapsed_seconds',
      render: (value) => (typeof value === 'number' ? value.toFixed(1) : '--'),
      width: 120,
    },
  ]), []);

  const sampleColumns = useMemo(() => ([
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 70,
    },
    {
      title: '状态',
      dataIndex: 'is_correct',
      key: 'is_correct',
      width: 90,
      render: (_, record) => {
        if (record.skipped) {
          return <Tag>跳过</Tag>;
        }
        if (!record.included_in_metrics) {
          return <Tag color="orange">未计入</Tag>;
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
      width: 110,
      render: (value) => (typeof value === 'number' ? value.toFixed(3) : '--'),
    },
    {
      title: '备注',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (value) => <Text type="secondary">{value || '--'}</Text>,
    },
  ]), []);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>测评历史</Title>

      <Card style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          loading={historyLoading}
          dataSource={historyData}
          columns={summaryColumns}
          pagination={{
            current: historyPagination.current,
            pageSize: historyPagination.pageSize,
            total: historyPagination.total,
            showSizeChanger: true,
          }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => {
              setHighlightedId(record.id);
              handleOpenDetail(record.id, detailTab);
            },
          })}
          rowClassName={(record) => (record.id === highlightedId ? 'evaluation-row-highlight' : '')}
        />
      </Card>

      <Drawer
        title="测评详情"
        width={980}
        open={drawerVisible}
        onClose={handleCloseDrawer}
        destroyOnClose
      >
        {detailLoading && !detailData ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spin size="large" />
          </div>
        ) : detailData ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="模型">{detailData.model_name}</Descriptions.Item>
              <Descriptions.Item label="数据集">{detailData.dataset_name}</Descriptions.Item>
              <Descriptions.Item label="任务类型">{detailData.benchmark_type || '--'}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(detailData.status)}</Descriptions.Item>
              <Descriptions.Item label="总样本">{detailData.total_prompts ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="已评估">{detailData.evaluated_prompts ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="正确样本">{detailData.correct_answers ?? '--'}</Descriptions.Item>
              <Descriptions.Item label="耗时 (s)">{
                typeof detailData.elapsed_seconds === 'number' ? detailData.elapsed_seconds.toFixed(1) : '--'
              }</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatDateTime(detailData.created_at)}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{formatDateTime(detailData.completed_at)}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="指标">
              <Space size="large">
                {Object.entries(detailData.metrics || {}).map(([key, value]) => (
                  <StatisticBlock key={key} title={key} value={value} />
                ))}
                {Object.keys(detailData.metrics || {}).length === 0 && <Text type="secondary">暂无指标</Text>}
              </Space>
            </Card>

            <Tabs
              activeKey={detailTab}
              onChange={handleDetailTabChange}
              items={[
                { key: 'errors', label: '错误案例' },
                { key: 'all', label: '全部样本' },
              ]}
            />
            <SamplesTable
              loading={detailLoading}
              data={detailData.samples}
              columns={sampleColumns}
              pagination={detailPagination}
              onChange={handleDetailTableChange}
            />
          </Space>
        ) : (
          <Text type="secondary">暂无可展示的数据</Text>
        )}
      </Drawer>
    </div>
  );
};

const StatisticBlock = ({ title, value }) => (
  <div style={{ minWidth: 120 }}>
    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>{title.toUpperCase()}</Text>
    <Text strong style={{ fontSize: 20 }}>{typeof value === 'number' ? `${value}%` : value}</Text>
  </div>
);

const SamplesTable = ({ loading, data, columns, pagination, onChange }) => (
  <Table
    size="small"
    rowKey={(record) => `${record.index}-${record.prompt?.slice(0, 8)}`}
    loading={loading}
    columns={columns}
    dataSource={data || []}
    pagination={{
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total,
      showSizeChanger: true,
    }}
    onChange={onChange}
    scroll={{ x: 960, y: 360 }}
  />
);

export default DatasetEvaluationHistoryPage;
