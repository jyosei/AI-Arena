import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  List,
  Spin,
  Input,
  Select,
  Row,
  Col,
  Space,
  Typography,
  Avatar,
  Tag,
  Modal,
  Form,
  message,
  Empty,
  Upload,
} from 'antd';
import {
  MessageOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FireOutlined,
  PlusOutlined,
  EyeOutlined,
  LikeOutlined,
  UploadOutlined,
} from '@ant-design/icons';

import {
  fetchForumPosts,
  fetchForumCategories,
  fetchForumTags,
  createForumPost,
  uploadForumAttachment,
  deleteForumAttachment,
  toggleForumPostLike,
} from '../api/forum';
import AuthContext from '../contexts/AuthContext.jsx';

const { Search } = Input;
const { Text, Title } = Typography;

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
};

const IconText = ({ icon, text }) => (
  <Space>
    {React.createElement(icon)}
    {text}
  </Space>
);

// 发布新帖组件
const PostForm = ({ visible, onCancel, onSuccess, categories, tagSuggestions }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState([]);
  const maxAttachments = 6;

  const beforeUpload = (file) => {
    const isImage = (file.type || '').startsWith('image/');
    if (!isImage) {
      message.error('仅支持上传图片文件');
      return Upload.LIST_IGNORE;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('单张图片大小不能超过 5MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleUpload = async ({ file, onError, onSuccess: cbSuccess }) => {
    setFileList((prev) => [
      ...prev,
      { uid: file.uid, name: file.name, status: 'uploading' },
    ]);
    try {
      const { data } = await uploadForumAttachment(file);
      setFileList((prev) =>
        prev.map((item) =>
          item.uid === file.uid ? { ...item, status: 'done', url: data.url, response: data } : item
        )
      );
      cbSuccess(data, file);
    } catch (error) {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
      onError(error);
      message.error('图片上传失败，请稍后重试');
    }
  };

  const handleRemove = async (file) => {
    if (file.status === 'done' && file.response?.id) {
      try {
        await deleteForumAttachment(file.response.id);
      } catch {}
    }
    setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
    return true;
  };

  const handleSubmit = async (values) => {
    if (fileList.some((item) => item.status === 'uploading')) {
      message.warning('请等待所有图片上传完成后再发布');
      return;
    }
    setSubmitting(true);
    try {
      const attachmentIds = fileList.map((item) => item.response?.id).filter(Boolean);
      const payload = {
        title: values.title,
        content: values.content,
        tags: values.tags || [],
        category_id: values.category ? Number(values.category) : null,
      };
      if (attachmentIds.length) payload.attachment_ids = attachmentIds;
      const response = await createForumPost(payload);
      message.success('帖子发布成功');
      form.resetFields();
      setFileList([]);
      onSuccess(response.data);
    } catch (error) {
      const detail = error.response?.data?.detail;
      message.error(detail || '发布失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="发布新帖"
      open={visible}
      onCancel={() => {
        form.resetFields();
        setFileList([]);
        onCancel();
      }}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={720}
      okText="发布"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="category" label="选择板块" rules={[{ required: true, message: '请选择板块' }]}>
          <Select placeholder="请选择板块">
            {categories.filter((cat) => cat.value !== 'all').map((cat) => (
              <Select.Option key={cat.value} value={cat.value}>{cat.label}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="title" label="帖子标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input placeholder="请输入帖子标题" maxLength={200} showCount />
        </Form.Item>

        <Form.Item name="content" label="帖子内容" rules={[{ required: true, message: '请输入内容' }]}>
          <Input.TextArea rows={10} placeholder="请输入帖子内容..." showCount maxLength={10000} />
        </Form.Item>

        <Form.Item label="图片附件">
          <Upload
            name="file"
            listType="picture-card"
            customRequest={handleUpload}
            onRemove={handleRemove}
            beforeUpload={beforeUpload}
            fileList={fileList}
            accept="image/*"
            multiple
          >
            {fileList.length >= maxAttachments ? null : (
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传</div>
              </div>
            )}
          </Upload>
          <Text type="secondary">支持 PNG/JPG/GIF，单张不超过 5MB，最多上传 6 张。</Text>
        </Form.Item>

        <Form.Item name="tags" label="标签">
          <Select
            mode="tags"
            placeholder="添加标签（可选）"
            style={{ width: '100%' }}
            options={tagSuggestions.map((tag) => ({ value: tag, label: tag }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default function Forum() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [searchParams, setSearchParams] = useState({ sort: 'latest', category: 'all', search: '' });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [categoryOptions, setCategoryOptions] = useState([{ value: 'all', label: '全部板块' }]);
  const [tagSuggestions, setTagSuggestions] = useState([]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetchForumCategories();
      const payload = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const options = payload.map((cat) => ({ value: String(cat.id), label: cat.name }));
      setCategoryOptions([{ value: 'all', label: '全部板块' }, ...options]);
    } catch {}
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetchForumTags();
      const payload = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setTagSuggestions(payload.map((tag) => tag.name || tag));
    } catch {}
  }, []);

  const loadPosts = useCallback(async ({ paramsOverride, page } = {}) => {
    const filters = paramsOverride || searchParams;
    const currentPage = page || (paramsOverride ? 1 : pagination.current);
    setLoading(true);
    try {
      const requestParams = { page: currentPage, page_size: pagination.pageSize };
      if (filters.category && filters.category !== 'all') requestParams.category = filters.category;
      if (filters.sort) requestParams.ordering = filters.sort;
      if (filters.search) requestParams.search = filters.search;

      const res = await fetchForumPosts(requestParams);
      const payload = res.data;
      const items = Array.isArray(payload) ? payload : payload.results || [];
      const total = payload.count ?? items.length;
      setPosts(items);
      setPagination((prev) => ({ ...prev, current: currentPage, total }));
      if (paramsOverride) setSearchParams(paramsOverride);
    } catch {
      message.error('加载帖子失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, searchParams]);

  useEffect(() => {
    fetchCategories();
    fetchTags();
    loadPosts();
  }, [fetchCategories, fetchTags, loadPosts]);

  const handleSearch = async (value) => loadPosts({ paramsOverride: { ...searchParams, search: value }, page: 1 });
  const handleSortChange = async (value) => loadPosts({ paramsOverride: { ...searchParams, sort: value }, page: 1 });
  const handleCategoryChange = async (value) => loadPosts({ paramsOverride: { ...searchParams, category: value }, page: 1 });

  const handleNewPostSuccess = async () => {
    setShowPostForm(false);
    await loadPosts({ page: 1 });
  };

  const handleOpenPostForm = () => {
    if (!user) {
      message.info('请先登录后再发帖');
      navigate('/login', { state: { from: '/forum' } });
      return;
    }
    setShowPostForm(true);
  };

  const handleToggleLike = async (post) => {
    if (!user) {
      message.warning('请先登录后再点赞');
      return;
    }
    try {
      const res = await toggleForumPostLike(post.id);
      const { liked, likes_count } = res.data;
      setPosts((prev) =>
        prev.map((item) => (item.id === post.id ? { ...item, likes_count, is_liked: liked } : item))
      );
    } catch {
      message.error('操作失败，请稍后再试');
    }
  };

  const paginationConfig = useMemo(() => {
    if (!pagination.total || pagination.total <= pagination.pageSize) return false;
    return {
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total,
      onChange: (pageNumber) => loadPosts({ page: pageNumber }),
      showSizeChanger: false,
    };
  }, [pagination, loadPosts]);

  const handlePostClick = (postId) => navigate(`/forum/post/${postId}`);

  return (
    <Card title="社区论坛">
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space wrap size="middle">
            <Select value={searchParams.category} onChange={handleCategoryChange} style={{ width: 140 }}>
              {categoryOptions.map((cat) => (
                <Select.Option key={cat.value} value={cat.value}>{cat.label}</Select.Option>
              ))}
            </Select>
            <Select value={searchParams.sort} onChange={handleSortChange} style={{ width: 180 }}>
              <Select.Option value="latest"><ClockCircleOutlined /> 最新回复</Select.Option>
              <Select.Option value="newest"><PlusOutlined /> 最新发布</Select.Option>
              <Select.Option value="hot"><FireOutlined /> 热门帖子</Select.Option>
            </Select>
            <Search placeholder="搜索帖子标题或内容..." onSearch={handleSearch} style={{ width: 320 }} allowClear />
          </Space>
        </Col>
        <Col>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleOpenPostForm}>
            发布新帖
          </Button>
        </Col>
      </Row>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin size="large" tip="正在加载帖子..." /></div>
      ) : posts.length === 0 ? (
        <Empty description="暂无帖子" />
      ) : (
        <List
          itemLayout="vertical"
          size="large"
          dataSource={posts}
          rowKey={(item) => item.id}
          pagination={paginationConfig}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              actions={[
                <IconText icon={UserOutlined} text={item.author?.username || '匿名用户'} key="author" />,
                <IconText icon={MessageOutlined} text={item.comment_count ?? 0} key="comments" />,
                <IconText icon={EyeOutlined} text={item.view_count ?? 0} key="views" />,
                <Button
                  key="like-btn"
                  type="text"
                  icon={<LikeOutlined style={{ color: item.is_liked ? '#1677ff' : undefined }} />}
                  onClick={(e) => { e.stopPropagation(); handleToggleLike(item); }}
                  style={{ color: item.is_liked ? '#1677ff' : undefined }}
                >
                  {item.likes_count ?? 0}
                </Button>,
                <IconText icon={ClockCircleOutlined} text={`最后活跃 ${formatDateTime(item.last_activity_at)}`} key="activity" />,
              ]}
              extra={
                <Space direction="vertical" align="end">
                  {item.category?.name && <Tag color="blue">{item.category.name}</Tag>}
                  <div>{(item.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                </Space>
              }
              onClick={() => handlePostClick(item.id)}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                avatar={<Avatar src={item.author?.avatar} icon={<UserOutlined />} />}
                title={
                  <Title level={5} style={{ marginBottom: 4 }}>
                    {item.is_sticky && <Tag color="red" style={{ marginRight: 8 }}>置顶</Tag>}
                    {item.title}
                  </Title>
                }
                description={
                  <div>
                    <Text type="secondary">
                      由 {item.author?.username || '匿名用户'} 发布于 {formatDateTime(item.created_at)}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">{(item.excerpt || item.content || '').slice(0, 160)}...</Text>
                    </div>
                    {item.attachments?.length ? (
                      <Space wrap size="small" style={{ marginTop: 12 }}>
                        {item.attachments.slice(0, 3).map((attachment) => (
                          <img key={attachment.id} src={attachment.url} alt="附件预览"
                               style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #f0f0f0' }} />
                        ))}
                        {item.attachments.length > 3 && <Tag color="default">+{item.attachments.length - 3}</Tag>}
                      </Space>
                    ) : null}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      <PostForm
        visible={showPostForm}
        onCancel={() => setShowPostForm(false)}
        onSuccess={handleNewPostSuccess}
        categories={categoryOptions}
        tagSuggestions={tagSuggestions}
      />
    </Card>
  );
}
