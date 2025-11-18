import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  List,
  Input,
  Avatar,
  Typography,
  Space,
  Divider,
  Tag,
  Row,
  Col,
  message,
  Spin,
  Form
} from 'antd';
import {
  UserOutlined,
  LikeOutlined,
  MessageOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ShareAltOutlined
} from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// 模拟数据（实际应该从API获取）
const fakePostDetail = {
  id: 1,
  title: '大家觉得哪个模型在写代码方面表现最好？',
  author: 'AI爱好者',
  content: `最近在尝试不同的AI模型来辅助编程，发现有些模型在代码生成方面表现特别出色。

## 尝试过的模型：

### GPT-4
- **优点**：代码理解能力强，逻辑清晰
- **缺点**：有时会过度复杂化简单问题
- **适用场景**：复杂算法、系统设计

### Claude
- **优点**：代码安全性好，遵循最佳实践
- **缺点**：对中文支持相对较弱
- **适用场景**：企业级项目、安全敏感代码

### 文心一言
- **优点**：中文注释写得不错，本土化好
- **缺点**：复杂逻辑处理能力有限
- **适用场景**：日常脚本、中文项目

## 我的使用经验

在实际项目中，我通常会根据具体需求选择模型：
- 需要高质量算法实现时用 GPT-4
- 需要安全可靠的代码时用 Claude  
- 需要快速原型开发时用文心一言

大家有什么推荐的吗？欢迎分享使用经验！`,
  replies: 12,
  views: 152,
  lastActivity: '5 分钟前',
  createdAt: '2025-01-15 10:30:00',
  avatar: 'https://joeschmoe.io/api/v1/random',
  tags: ['技术讨论', '代码', 'AI模型'],
  category: '技术交流',
  likes: 8,
  isSticky: false
};

const fakeReplies = [
  {
    id: 1,
    author: '程序员小王',
    content: '我觉得GPT-4在代码理解方面表现最好，特别是对于复杂算法。最近用它重构了一个旧项目，效率提升很明显。另外它在理解业务逻辑方面也很出色。',
    createdAt: '2025-01-15 10:35:00',
    avatar: 'https://joeschmoe.io/api/v1/male',
    likes: 3,
    isAuthor: false
  },
  {
    id: 2,
    author: '开发者小李',
    content: '推荐Claude，它在代码安全性和最佳实践方面做得很好。特别是企业级项目，安全性很重要。我们团队现在主要用Claude来做代码审查。',
    createdAt: '2025-01-15 10:40:00',
    avatar: 'https://joeschmoe.io/api/v1/female',
    likes: 5,
    isAuthor: false
  },
  {
    id: 3,
    author: '全栈工程师',
    content: '其实可以结合使用，不同场景用不同模型。我平时写业务代码用GPT-4，写工具函数用Claude，写文档用文心一言。',
    createdAt: '2025-01-15 11:20:00',
    avatar: 'https://joeschmoe.io/api/v1/joe',
    likes: 8,
    isAuthor: false
  }
];

export default function ForumPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchPostDetail();
  }, [id]);

  const fetchPostDetail = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      setTimeout(() => {
        setPost(fakePostDetail);
        setReplies(fakeReplies);
        setLoading(false);
      }, 500);
    } catch (error) {
      message.error('加载帖子失败');
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) {
      message.warning('请输入回复内容');
      return;
    }

    setSubmitting(true);
    try {
      // 模拟提交回复
      setTimeout(() => {
        const newReply = {
          id: replies.length + 1,
          author: '当前用户',
          content: replyContent,
          createdAt: '刚刚',
          avatar: 'https://joeschmoe.io/api/v1/random',
          likes: 0,
          isAuthor: false
        };
        setReplies([...replies, newReply]);
        setReplyContent('');
        form.resetFields();
        setSubmitting(false);
        message.success('回复成功');
        
        // 更新帖子回复数
        setPost(prev => prev ? { ...prev, replies: prev.replies + 1 } : null);
      }, 500);
    } catch (error) {
      message.error('回复失败');
      setSubmitting(false);
    }
  };

  const handleLike = (replyId) => {
    // 模拟点赞功能
    setReplies(replies.map(reply => 
      reply.id === replyId 
        ? { ...reply, likes: reply.likes + 1 }
        : reply
    ));
  };

  const handleLikePost = () => {
    if (post) {
      setPost({ ...post, likes: post.likes + 1 });
      message.success('点赞成功');
    }
  };

  const handleShare = () => {
    // 模拟分享功能
    navigator.clipboard.writeText(window.location.href);
    message.success('链接已复制到剪贴板');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" tip="正在加载帖子..." />
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Title level={3}>帖子不存在</Title>
        <Button type="primary" onClick={() => navigate('/forum')}>
          返回论坛
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* 头部导航 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/forum')}
          >
            返回论坛
          </Button>
        </Col>
        <Col>
          <Space>
            <Button 
              icon={<LikeOutlined />}
              onClick={handleLikePost}
            >
              点赞 ({post.likes})
            </Button>
            <Button 
              icon={<ShareAltOutlined />}
              onClick={handleShare}
            >
              分享
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 帖子内容 */}
      <Card>
        {/* 标签和分类 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Tag color="blue">{post.category}</Tag>
            {post.tags.map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {post.isSticky && <Tag color="red">置顶</Tag>}
          </Space>
        </div>

        {/* 标题 */}
        <Title level={2} style={{ marginBottom: 16 }}>
          {post.title}
        </Title>
        
        {/* 作者信息 */}
        <div style={{ marginBottom: 24 }}>
          <Space size="middle">
            <Avatar src={post.avatar} size="large" />
            <div>
              <div>
                <Text strong>{post.author}</Text>
              </div>
              <div>
                <Text type="secondary">
                  <ClockCircleOutlined /> {post.createdAt} · 
                  <EyeOutlined style={{ marginLeft: 8 }} /> {post.views} 浏览 · 
                  <MessageOutlined style={{ marginLeft: 8 }} /> {post.replies} 回复
                </Text>
              </div>
            </div>
          </Space>
        </div>

        {/* 帖子内容 */}
        <Paragraph style={{ 
          fontSize: '16px', 
          lineHeight: '1.8',
          whiteSpace: 'pre-line'
        }}>
          {post.content}
        </Paragraph>

        <Divider />
        
        {/* 回复统计 */}
        <div style={{ marginBottom: 16 }}>
          <Title level={4}>{replies.length} 条回复</Title>
        </div>

        {/* 回复列表 */}
        <List
          itemLayout="horizontal"
          dataSource={replies}
          renderItem={reply => (
            <List.Item
              actions={[
                <Button 
                  type="text" 
                  icon={<LikeOutlined />}
                  onClick={() => handleLike(reply.id)}
                >
                  {reply.likes}
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar src={reply.avatar} size="large" />}
                title={
                  <Space>
                    <Text strong>{reply.author}</Text>
                    {reply.isAuthor && <Tag color="blue">楼主</Tag>}
                    <Text type="secondary">{reply.createdAt}</Text>
                  </Space>
                }
                description={
                  <Paragraph style={{ margin: 0, fontSize: '15px', lineHeight: '1.6' }}>
                    {reply.content}
                  </Paragraph>
                }
              />
            </List.Item>
          )}
        />

        {/* 回复表单 */}
        <Divider />
        <div style={{ marginTop: 32 }}>
          <Title level={5}>发表回复</Title>
          <Form form={form} onFinish={handleReply}>
            <Form.Item
              name="content"
              rules={[{ required: true, message: '请输入回复内容' }]}
            >
              <TextArea
                rows={6}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="请输入你的回复..."
                style={{ marginBottom: 16 }}
                showCount
                maxLength={2000}
              />
            </Form.Item>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={submitting}
              size="large"
            >
              发表回复
            </Button>
          </Form>
        </div>
      </Card>
    </div>
  );
}