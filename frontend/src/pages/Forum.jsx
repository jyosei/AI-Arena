import React, { useState, useEffect } from 'react';
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
  message
} from 'antd';
import {
  MessageOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FireOutlined,
  PlusOutlined,
  EyeOutlined,
  LikeOutlined
} from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;
const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// 扩展的模拟数据
const fakePosts = [
  {
    id: 1,
    title: '大家觉得哪个模型在写代码方面表现最好？',
    author: 'AI爱好者',
    content: '最近在尝试不同的AI模型来辅助编程，发现有些模型在代码生成方面表现特别出色。大家有什么推荐的吗？',
    replies: 12,
    views: 152,
    lastActivity: '5 分钟前',
    createdAt: '2025-01-15 10:30:00',
    avatar: 'https://joeschmoe.io/api/v1/random',
    tags: ['技术讨论', '代码'],
    category: '技术交流',
    likes: 8,
    isSticky: false
  },
  {
    id: 2,
    title: 'Compare 页面 Battle 模式的建议：希望增加匿名投票',
    author: '产品经理',
    content: '目前Compare页面的Battle模式显示用户信息，建议增加匿名投票功能让结果更客观。',
    replies: 5,
    views: 88,
    lastActivity: '1 小时前',
    createdAt: '2025-01-15 09:30:00',
    avatar: 'https://joeschmoe.io/api/v1/female',
    tags: ['功能建议'],
    category: '功能建议',
    likes: 3,
    isSticky: true
  },
  {
    id: 3,
    title: 'Leaderboard 分数是如何计算的？',
    author: '数据科学家',
    content: '对排行榜的评分机制很感兴趣，想知道具体的算法和权重分配。',
    replies: 3,
    views: 201,
    lastActivity: '3 小时前',
    createdAt: '2025-01-15 07:30:00',
    avatar: 'https://joeschmoe.io/api/v1/male',
    tags: ['问题'],
    category: '问题反馈',
    likes: 2,
    isSticky: false
  },
  {
    id: 4,
    title: '我用 GLM-4 写了一首诗，大家品鉴一下',
    author: '诗人',
    content: '春江潮水连海平，海上明月共潮生。滟滟随波千万里，何处春江无月明！',
    replies: 28,
    views: 540,
    lastActivity: '8 小时前',
    createdAt: '2025-01-14 14:30:00',
    avatar: 'https://joeschmoe.io/api/v1/T',
    tags: ['作品分享', 'GLM-4'],
    category: '作品分享',
    likes: 15,
    isSticky: false
  },
];

const categories = [
  { value: 'all', label: '全部板块' },
  { value: '技术交流', label: '技术交流' },
  { value: '功能建议', label: '功能建议' },
  { value: '作品分享', label: '作品分享' },
  { value: '问题反馈', label: '问题反馈' }
];

// 发布新帖组件
const PostForm = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      // 模拟API调用
      setTimeout(() => {
        console.log('发布新帖:', values);
        message.success('帖子发布成功');
        form.resetFields();
        onSuccess();
        setSubmitting(false);
      }, 1000);
    } catch (error) {
      message.error('发布失败');
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="发布新帖"
      open={visible}
      onCancel={handleCancel}
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
      </Form>
    </Modal>
  );
};

export default function Forum() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [searchParams, setSearchParams] = useState({
    sort: 'latest',
    category: 'all',
    search: ''
  });

  // 模拟数据获取
  const fetchPosts = () => {
    setLoading(true);
    setTimeout(() => {
      setPosts(fakePosts);
      setLoading(false);
    }, 800);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleSearch = (value) => {
    setSearchParams({ ...searchParams, search: value });
    // 实际应该调用搜索API
    console.log('搜索:', value);
  };

  const handleSortChange = (value) => {
    setSearchParams({ ...searchParams, sort: value });
    // 实际应该调用排序API
    console.log('排序:', value);
  };

  const handleCategoryChange = (value) => {
    setSearchParams({ ...searchParams, category: value });
    // 实际应该调用分类过滤API
    console.log('分类:', value);
  };

  const handleNewPostSuccess = () => {
    setShowPostForm(false);
    fetchPosts(); // 刷新帖子列表
  };

  const handlePostClick = (postId) => {
    navigate(`/forum/post/${postId}`);
  };

  const IconText = ({ icon, text }) => (
    <Space>
      {React.createElement(icon)}
      {text}
    </Space>
  );

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
            onClick={() => setShowPostForm(true)}
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
          renderItem={(item) => (
            <List.Item
              key={item.id}
              actions={[
                <IconText
                  icon={UserOutlined}
                  text={item.author}
                  key="list-author"
                />,
                <IconText
                  icon={MessageOutlined}
                  text={item.replies}
                  key="list-replies"
                />,
                <IconText
                  icon={EyeOutlined}
                  text={item.views}
                  key="list-views"
                />,
                <IconText
                  icon={LikeOutlined}
                  text={item.likes}
                  key="list-likes"
                />,
                <IconText
                  icon={ClockCircleOutlined}
                  text={`最后回复 ${item.lastActivity}`}
                  key="list-activity"
                />,
              ]}
              extra={
                <Space direction="vertical" align="end">
                  <Tag color={item.isSticky ? "red" : "blue"}>
                    {item.category}
                  </Tag>
                  <div>
                    {item.tags.map((tag) => (
                      <Tag key={tag} color="default">{tag}</Tag>
                    ))}
                  </div>
                </Space>
              }
            >
              <List.Item.Meta
                avatar={<Avatar src={item.avatar} icon={<UserOutlined />} />}
                title={
                  <a onClick={() => handlePostClick(item.id)} style={{ cursor: 'pointer' }}>
                    <Title level={5} style={{ marginBottom: 0 }}>
                      {item.isSticky && <Tag color="red" style={{ marginRight: 8 }}>置顶</Tag>}
                      {item.title}
                    </Title>
                  </a>
                }
                description={
                  <div>
                    <Text type="secondary">
                      由 {item.author} 发布于 {item.createdAt}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">{item.content.substring(0, 100)}...</Text>
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
        onSuccess={handleNewPostSuccess}
      />
    </Card>
  );
}