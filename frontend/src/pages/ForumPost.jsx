import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Form,
  Upload
} from 'antd';
import {
  LikeOutlined,
  MessageOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ShareAltOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Image } from 'antd';
import { fetchForumPost, createForumComment, toggleForumPostLike, toggleForumCommentLike } from '../api/forum';
import { resolveMediaUrl, getPublicOrigin, FALLBACK_IMG } from '../utils/media';
import AuthContext from '../contexts/AuthContext.jsx';
import ShareModal from '../components/ShareModal';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

export default function ForumPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = React.useContext(AuthContext);
  const [post, setPost] = useState(null); // 后端返回的完整帖子对象
  const [replies, setReplies] = useState([]); // comments 数组
  const [loading, setLoading] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [replyImages, setReplyImages] = useState([]); // 上传的评论图片文件列表
  const [shareModalVisible, setShareModalVisible] = useState(false); // 分享弹窗状态
  const topRef = useRef(null);

  // 根据 hash 定位评论
  const scrollToHash = useCallback(() => {
    const anchor = window.location.hash?.replace('#', '');
    if (anchor && anchor.startsWith('comment-')) {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  useEffect(() => {
    loadPost();
  }, [id]);

  useEffect(() => {
    scrollToHash();
  }, [post, scrollToHash]);

  const loadPost = async () => {
    setLoading(true);
    try {
      const res = await fetchForumPost(id);
      const data = res.data;
      setPost(data);
      setReplies(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) {
      message.error(e.response?.data?.detail || '加载帖子失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) {
      message.warning('请输入回复内容');
      return;
    }
    if (!user) {
      message.warning('请先登录再发表评论');
      return;
    }

    setSubmitting(true);
    try {
      const images = replyImages.map(f => f.originFileObj).filter(Boolean);
      const res = await createForumComment(id, { content: replyContent, images });
      const newComment = res.data;
      setReplies(prev => [...prev, newComment]);
      setPost(prev => (prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev));
      setReplyContent('');
      setReplyImages([]);
      form.resetFields();
      message.success('回复成功');
    } catch (e) {
      message.error(e.response?.data?.detail || '回复失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    if (!user) {
      message.warning('请先登录');
      return;
    }
    try {
      const res = await toggleForumCommentLike(commentId);
      const { liked, likes_count } = res.data;
      setReplies(prev => prev.map(c => c.id === commentId ? { ...c, is_liked: liked, likes_count } : c));
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleLikePost = () => {
    if (!user) {
      message.warning('请先登录');
      return;
    }
    if (!post) return;
    toggleForumPostLike(post.id)
      .then(res => {
        const { liked, likes_count } = res.data;
        setPost(p => (p ? { ...p, is_liked: liked, likes_count } : p));
      })
      .catch(() => message.error('点赞失败'));
  };

  const handleShare = () => {
    if (!post) return;
    setShareModalVisible(true);
  };

  const uploadProps = {
    multiple: true,
    fileList: replyImages,
    beforeUpload: () => false,
    onChange: ({ fileList }) => setReplyImages(fileList.slice(0, 6)), // 限制最多6张
    accept: 'image/*'
  };

  const renderPostImages = () => {
    const images = post?.images ?? [];
    if (images.length === 0) return null;
    return (
      <div style={{ margin: '16px 0' }}>
        <Image.PreviewGroup>
          <Space wrap>
            {images.map((img) => {
              const url = resolveMediaUrl(img.image_url || img.image);
              return (
                <Image
                  key={img.id}
                  src={url}
                  alt="post-img"
                  width={160}
                  height={120}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                  fallback={FALLBACK_IMG}
                  preview={{ src: url }}
                />
              );
            })}
          </Space>
        </Image.PreviewGroup>
      </div>
    );
  };

  const renderCommentImages = (comment) => {
    const images = comment.images ?? [];
    if (images.length === 0) return null;
    return (
      <Image.PreviewGroup>
        <Space wrap style={{ marginTop: 8 }}>
          {images.map((ci) => {
            const url = resolveMediaUrl(ci.image_url || ci.image);
            return (
              <Image
                key={ci.id}
                src={url}
                alt="comment-img"
                width={120}
                height={90}
                style={{ objectFit: 'cover', borderRadius: 4 }}
                fallback={FALLBACK_IMG}
                preview={{ src: url }}
              />
            );
          })}
        </Space>
      </Image.PreviewGroup>
    );
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
      {/* 分享弹窗 */}
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        shareUrl={`${getPublicOrigin()}/forum/post/${post?.id || id}`}
        title={post?.title}
      />

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
              type={post.is_liked ? 'primary' : 'default'}
              icon={<LikeOutlined />}
              onClick={handleLikePost}
            >
              点赞 ({post.likes_count || 0})
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

      <div ref={topRef} />
      <Card>
        {/* 标签和分类 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            {post.category && <Tag color="blue">{post.category}</Tag>}
            {(post.tags || []).map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {post.is_sticky && <Tag color="red">置顶</Tag>}
          </Space>
        </div>

        {/* 标题 */}
        <Title level={2} style={{ marginBottom: 16 }}>{post.title}</Title>
        
        {/* 作者信息 */}
        <div style={{ marginBottom: 24 }}>
          <Space size="middle">
            <Avatar src={resolveMediaUrl(post.author?.avatar)} size="large" />
            <div>
              <div>
                <Text strong>{post.author?.username || '匿名用户'}</Text>
              </div>
              <div>
                <Text type="secondary">
                  <ClockCircleOutlined /> {new Date(post.created_at).toLocaleString()} ·
                  <EyeOutlined style={{ marginLeft: 8 }} /> {post.views} 浏览 ·
                  <MessageOutlined style={{ marginLeft: 8 }} /> {(post.comments_count ?? replies.length)} 回复
                </Text>
              </div>
            </div>
          </Space>
        </div>

        {/* 帖子正文 */}
        <Paragraph style={{ fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{post.content}</Paragraph>
        {renderPostImages()}

        <Divider />
        
        {/* 回复统计 */}
        <div style={{ marginBottom: 16 }}>
          <Title level={4}>{post.comments_count ?? replies.length} 条回复</Title>
        </div>

        {/* 回复列表 */}
        <List
          itemLayout="horizontal"
          dataSource={replies}
          renderItem={reply => {
            const postAuthorId = post?.author?.id ?? post?.author?.pk ?? null;
            const replyAuthorId = reply?.author?.id ?? reply?.author?.pk ?? null;
            const isPostAuthor =
              postAuthorId !== null && replyAuthorId !== null && String(replyAuthorId) === String(postAuthorId);

            return (
              <List.Item
                key={reply.id}
              id={`comment-${reply.id}`}
              style={{ scrollMarginTop: 80 }}
              actions={[
                <Button
                  type={reply.is_liked ? 'primary' : 'text'}
                  icon={<LikeOutlined />}
                  onClick={() => handleCommentLike(reply.id)}
                >
                  {reply.likes_count || 0}
                </Button>
              ]}
              >
                <List.Item.Meta
                  avatar={<Avatar src={resolveMediaUrl(reply.author?.avatar)} size="large" />}
                  title={
                    <Space>
                      <Text strong>{reply.author?.username || '用户'}</Text>
                      {isPostAuthor && <Tag color="blue">楼主</Tag>}
                      <Text type="secondary">{new Date(reply.created_at).toLocaleString()}</Text>
                    </Space>
                  }
                  description={
                    <div>
                      <Paragraph style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                        {reply.content}
                      </Paragraph>
                      {renderCommentImages(reply)}
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />

        {/* 回复表单 */}
        <Divider />
        <div style={{ marginTop: 32 }}>
          <Title level={5}>发表回复</Title>
          <Form form={form} layout="vertical" onFinish={handleReply}>
            <Form.Item name="content" rules={[{ required: true, message: '请输入回复内容' }]}> 
              <TextArea
                rows={6}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="请输入你的回复..."
                showCount
                maxLength={3000}
              />
            </Form.Item>
            <Form.Item label="评论图片（最多6张）">
              <Upload {...uploadProps} listType="picture" itemRender={(originNode) => originNode}>
                <Button icon={<UploadOutlined />}>选择图片</Button>
              </Upload>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} size="large">发表回复</Button>
          </Form>
        </div>
      </Card>
    </div>
  );
}