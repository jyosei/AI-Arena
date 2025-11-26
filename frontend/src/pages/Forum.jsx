import React, { useState, useEffect, useCallback, useContext } from 'react';
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
  Upload
} from 'antd';
import {
  MessageOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FireOutlined,
  PlusOutlined,
  EyeOutlined,
  LikeOutlined,
  LikeFilled,
  StarOutlined,
  StarFilled,
  UploadOutlined
} from '@ant-design/icons';
import { fetchForumPosts, createForumPost, toggleForumPostLike, toggleForumPostFavorite } from '../api/forum';
import { resolveMediaUrl } from '../utils/media';
import AuthContext from '../contexts/AuthContext.jsx';

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;
const { TextArea } = Input;

const PAGE_SIZE = 10;

const categories = [
  { value: 'all', label: '全部板块' },
  { value: '技术交流', label: '技术交流' },
  { value: '功能建议', label: '功能建议' },
  { value: '作品分享', label: '作品分享' },
  { value: '问题反馈', label: '问题反馈' }
];

// 发布新帖组件
const PostForm = ({ visible, onCancel, onSubmit, submitting }) => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setFileList([]);
    }
  }, [visible, form]);

  const handleSubmit = async (values) => {
    const files = fileList.map((f) => f.originFileObj).filter(Boolean);
    await onSubmit({ ...values, images: files });
    form.resetFields();
    setFileList([]);
  };

  const uploadProps = {
    multiple: true,
    fileList,
    beforeUpload: () => false,
    onChange: ({ fileList: next }) => setFileList(next.slice(0, 6)),
    accept: 'image/*'
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
      width={700}
      okText="发布"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="category"
          label="选择板块"
          rules={[{ required: true, message: '请选择板块' }]}
        >
          <Select placeholder="请选择板块">
            <Option value="技术交流">技术交流</Option>
            <Option value="功能建议">功能建议</Option>
            <Option value="作品分享">作品分享</Option>
            <Option value="问题反馈">问题反馈</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="title"
          label="帖子标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="请输入帖子标题" />
        </Form.Item>

        <Form.Item
          name="content"
          label="帖子内容"
          rules={[{ required: true, message: '请输入内容' }]}
        >
          <TextArea 
            rows={8} 
            placeholder="请输入帖子内容..." 
            showCount 
            maxLength={5000}
          />
        </Form.Item>

        <Form.Item
          name="tags"
          label="标签"
        >
          <Select mode="tags" placeholder="添加标签（可选）" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="附件图片（最多9张）">
          <Upload {...uploadProps} listType="picture-card">
            {fileList.length >= 9 ? null : (
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>上传</div>
              </div>
            )}
          </Upload>
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
  const [creatingPost, setCreatingPost] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [searchParams, setSearchParams] = useState({
    sort: 'latest',
    category: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);

  const loadPosts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        ...searchParams,
        page,
        page_size: PAGE_SIZE,
      };
      const res = await fetchForumPosts(params);
      const data = res.data;
      const items = Array.isArray(data) ? data : (data.results || []);
      const total = data.count !== undefined ? data.count : items.length;
      setPosts(items);
      setCurrentPage(page);
      setTotalPosts(total);
    } catch (error) {
      const detail = error.response?.data?.detail || '帖子加载失败，请稍后重试';
      message.error(detail);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadPosts(currentPage);
  }, [loadPosts, currentPage]);

  const handleSearch = (value) => {
    setCurrentPage(1);
    setSearchParams((prev) => ({ ...prev, search: value }));
  };

  const handleSortChange = (value) => {
    setCurrentPage(1);
    setSearchParams((prev) => ({ ...prev, sort: value }));
  };

  const handleCategoryChange = (value) => {
    setCurrentPage(1);
    setSearchParams((prev) => ({ ...prev, category: value }));
  };

  const handleCreatePost = async ({ title, content, category, tags = [], images = [] }) => {
    if (!user) {
      message.warning('请先登录后再发布新帖');
      return;
    }
    setCreatingPost(true);
    try {
      const res = await createForumPost({ title, content, category, tags, images });
      message.success('帖子发布成功');
      setShowPostForm(false);
      await loadPosts(1);
      if (res?.data?.id) {
        navigate(`/forum/post/${res.data.id}`);
      }
    } catch (error) {
      const detail = error.response?.data?.detail || '发布失败，请稍后重试';
      message.error(detail);
    } finally {
      setCreatingPost(false);
    }
  };

  const handlePostClick = (postId) => {
    navigate(`/forum/post/${postId}`);
  };

  const handleToggleLike = async (post) => {
    if (!user) {
      message.warning('请先登录后再点赞');
      return;
    }
    try {
      const res = await toggleForumPostLike(post.id);
      const { liked, likes_count, favorites_count, is_favorited } = res.data;
      setPosts((prev) => prev.map((item) => (item.id === post.id ? {
        ...item,
        likes_count,
        is_liked: liked,
        favorites_count: favorites_count ?? item.favorites_count,
        is_favorited: is_favorited ?? item.is_favorited,
      } : item)));
    } catch (error) {
      message.error('操作失败，请稍后再试');
    }
  };

  const handleToggleFavorite = async (post) => {
    if (!user) {
      message.warning('请先登录后再收藏');
      return;
    }
    try {
      const res = await toggleForumPostFavorite(post.id);
      const { favorited, favorites_count, likes_count, is_liked } = res.data;
      setPosts((prev) => prev.map((item) => (item.id === post.id ? {
        ...item,
        favorites_count,
        is_favorited: favorited,
        likes_count: likes_count ?? item.likes_count,
        is_liked: is_liked ?? item.is_liked,
      } : item)));
    } catch (error) {
      message.error('操作失败，请稍后再试');
    }
  };

  const renderActions = (item) => ([
    <Space key="list-author">
      <UserOutlined />
      {item.author?.username || '匿名用户'}
    </Space>,
    <Space key="list-comments">
      <MessageOutlined />
      {item.comments_count || 0}
    </Space>,
    <Space key="list-views">
      <EyeOutlined />
      {item.views || 0}
    </Space>,
    <Button
      key="list-likes"
      type="text"
      icon={item.is_liked ? <LikeFilled style={{ color: '#ff4d4f' }} /> : <LikeOutlined />}
      onClick={(e) => {
        e.stopPropagation();
        handleToggleLike(item);
      }}
      style={{ color: item.is_liked ? '#ff4d4f' : undefined }}
    >
      {item.likes_count || 0}
    </Button>,
    <Button
      key="list-favorites"
      type="text"
      icon={item.is_favorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
      onClick={(e) => {
        e.stopPropagation();
        handleToggleFavorite(item);
      }}
      style={{ color: item.is_favorited ? '#faad14' : undefined }}
    >
      {item.favorites_count || 0}
    </Button>,
    <Space key="list-activity">
      <ClockCircleOutlined />
      {item.last_activity ? new Date(item.last_activity).toLocaleString() : ''}
    </Space>,
  ]);

  return (
    <Card title="社区论坛">
      {/* 控件区域 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space wrap size="middle">
            <Select 
              value={searchParams.category} 
              onChange={handleCategoryChange}
              style={{ width: 120 }}
            >
              {categories.map(cat => (
                <Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Option>
              ))}
            </Select>
            
            <Select 
              value={searchParams.sort} 
              onChange={handleSortChange}
              style={{ width: 180 }}
            >
              <Option value="latest">
                <ClockCircleOutlined /> 最新回复
              </Option>
              <Option value="newest">
                <PlusOutlined /> 最新发布
              </Option>
              <Option value="hot">
                <FireOutlined /> 热门帖子
              </Option>
            </Select>
            
            <Search
              placeholder="搜索帖子标题或内容..."
              onSearch={handleSearch}
              style={{ width: 300 }}
              allowClear
            />
          </Space>
        </Col>
        <Col>
          <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />}
            onClick={() => {
              if (!user) {
                message.warning('请先登录后再发布新帖');
                return;
              }
              setShowPostForm(true);
            }}
          >
            发布新帖
          </Button>
        </Col>
      </Row>

      {/* 帖子列表区域 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="正在加载帖子..." />
        </div>
      ) : (
        <List
          itemLayout="vertical"
          size="large"
          dataSource={posts}
          rowKey={(item) => item.id}
          pagination={{
            current: currentPage,
            total: totalPosts,
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            onChange: (page) => setCurrentPage(page),
          }}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              style={{ cursor: 'pointer' }}
              actions={renderActions(item)}
              onClick={() => handlePostClick(item.id)}
              extra={
                <Space direction="vertical" align="end">
                  <Tag color={item.is_sticky ? 'red' : 'blue'}>
                    {item.category}
                  </Tag>
                  <div>
                    {(item.tags || []).map((tag) => (
                      <Tag key={tag} color="default">{tag}</Tag>
                    ))}
                  </div>
                </Space>
              }
            >
              <List.Item.Meta
                avatar={<Avatar src={resolveMediaUrl(item.author?.avatar)} icon={<UserOutlined />} />}
                title={
                  <Title level={5} style={{ marginBottom: 4 }}>
                    {item.is_sticky && <Tag color="red" style={{ marginRight: 8 }}>置顶</Tag>}
                    {item.title}
                  </Title>
                }
                description={
                  <div>
                    <Text type="secondary">
                      由 {item.author?.username || '匿名用户'} 发布于 {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">{item.excerpt || ''}</Text>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* 发布新帖模态框 */}
      <PostForm
        visible={showPostForm}
        onCancel={() => setShowPostForm(false)}
        onSubmit={handleCreatePost}
        submitting={creatingPost}
      />
    </Card>
  );
}