import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
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
  Upload,
  Image,
  message,
  Spin,
  Form,
  Tooltip,
} from 'antd';
import {
  LikeOutlined,
  MessageOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ShareAltOutlined,
  StarOutlined,
  UserOutlined,
  PlusOutlined,
} from '@ant-design/icons';

import AuthContext from '../contexts/AuthContext.jsx';
import {
  fetchForumPostDetail,
  fetchForumComments,
  createForumComment,
  reactToForumPost,
  reactToForumComment,
  shareForumPost,
  incrementForumPostView,
  uploadForumAttachment,
  deleteForumAttachment,
} from '../api/forum';
import ShareModal from '../components/ShareModal';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
};

// 将评论树展平，用于列表显示
const flattenComments = (items, depth = 0) =>
  items.flatMap((comment) => {
    const children = comment.children || [];
    const current = {
      ...comment,
      indent: depth,
      user_reactions: {
        like: false,
        favorite: false,
        ...(comment.user_reactions || {}),
      },
      attachments: comment.attachments || [],
    };
    return [current, ...flattenComments(children, depth + 1)];
  });

// 更新评论树中的指定评论
const updateCommentTree = (items, targetId, updater) =>
  items.map((comment) => {
    if (comment.id === targetId) return { ...comment, ...updater(comment) };
    if (comment.children?.length)
      return { ...comment, children: updateCommentTree(comment.children, targetId, updater) };
    return comment;
  });

// 向评论树中追加新评论
const appendComment = (items, parentId, newComment) => {
  if (!parentId) return [...items, newComment];
  return items.map((comment) => {
    if (comment.id === parentId) {
      const children = comment.children ? [...comment.children, newComment] : [newComment];
      return { ...comment, children };
    }
    if (comment.children?.length)
      return { ...comment, children: appendComment(comment.children, parentId, newComment) };
    return comment;
  });
};

// 标准化评论结构
const normalizeComment = (comment) => ({
  ...comment,
  user_reactions: { like: false, favorite: false, ...(comment.user_reactions || {}) },
  attachments: comment.attachments || [],
  children: (comment.children || []).map(normalizeComment),
});

export default function ForumPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [replyAttachments, setReplyAttachments] = useState([]);
  const replyAttachmentsRef = useRef([]);
  const maxReplyAttachments = 3;

  useEffect(() => {
    replyAttachmentsRef.current = replyAttachments;
  }, [replyAttachments]);

  // 页面卸载时清理未提交的附件
  useEffect(() => {
    return () => {
      replyAttachmentsRef.current
        .filter((item) => item.status === 'done' && item.response?.id)
        .forEach((item) => deleteForumAttachment(item.response.id).catch(() => null));
    };
  }, []);

  // 上传前验证
  const beforeReplyUpload = useCallback((file) => {
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
  }, []);

  // 上传处理
  const handleReplyUpload = useCallback(
    async ({ file, onError, onSuccess }) => {
      setReplyAttachments((prev) => [...prev, { uid: file.uid, name: file.name, status: 'uploading' }]);
      try {
        const { data } = await uploadForumAttachment(file);
        setReplyAttachments((prev) =>
          prev.map((item) =>
            item.uid === file.uid ? { ...item, status: 'done', url: data.url, response: data } : item
          )
        );
        onSuccess(data, file);
      } catch (error) {
        setReplyAttachments((prev) => prev.filter((item) => item.uid !== file.uid));
        onError(error);
        message.error('图片上传失败，请稍后再试');
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
    },
    []
  );

  // 删除附件
  const handleReplyRemove = useCallback(async (file) => {
    if (file.status === 'done' && file.response?.id) {
      await deleteForumAttachment(file.response.id).catch(() => null);
    }
    setReplyAttachments((prev) => prev.filter((item) => item.uid !== file.uid));
    return true;
  }, []);

  const cleanupReplyUploads = useCallback(async () => {
    const toDelete = replyAttachments.filter((item) => item.status === 'done' && item.response?.id);
    await Promise.all(toDelete.map((item) => deleteForumAttachment(item.response.id).catch(() => null)));
    setReplyAttachments([]);
  }, [replyAttachments]);

  const replyUploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>上传</div>
    </div>
  );

  // 加载帖子详情
  const loadPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchForumPostDetail(id);
      const postData = res.data;
      const normalizedPost = {
        ...postData,
        user_reactions: { like: false, favorite: false, ...(postData.user_reactions || {}) },
        tags: postData.tags || [],
        attachments: postData.attachments || [],
      };
      setPost(normalizedPost);
      // 增加浏览量
      try {
        const viewRes = await incrementForumPostView(id);
        const viewCount = viewRes?.data?.view_count;
        setPost((prev) =>
          prev
            ? { ...prev, view_count: typeof viewCount === 'number' ? viewCount : prev.view_count ?? 0 }
            : prev
        );
      } catch (viewError) {
        console.warn('增加浏览量失败:', viewError);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        message.error('帖子不存在或已被删除');
        navigate('/forum');
      } else {
        message.error(error.response?.data?.detail || '加载帖子失败');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // 加载评论
  const loadComments = useCallback(async () => {
    if (!id) return;
    setCommentsLoading(true);
    try {
      const res = await fetchForumComments(id);
      const payload = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setComments(payload.map(normalizeComment));
    } catch {
      message.error('加载评论失败');
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPost();
    loadComments();
  }, [loadPost, loadComments]);

  const flattenedComments = useMemo(() => flattenComments(comments), [comments]);

  const requireAuth = useCallback(() => {
    if (user) return true;
    message.info('请先登录后再操作');
    navigate('/login', { state: { from: `/forum/post/${id}` } });
    return false;
  }, [user, navigate, id]);

  const handleReactToPost = async (type) => {
    if (!requireAuth()) return;
    try {
      const res = await reactToForumPost(id, { type, action: 'toggle' });
      setPost((prev) =>
        prev
          ? {
              ...prev,
              like_count: res.data?.like_count ?? prev.like_count,
              favorite_count: res.data?.favorite_count ?? prev.favorite_count,
              user_reactions: { ...prev.user_reactions, [type]: res.data?.active ?? false },
            }
          : prev
      );
    } catch {
      message.error('操作失败，请稍后再试');
    }
  };

  const handleShare = async () => {
    try {
      await shareForumPost(id, { channel: 'web' });
      await navigator.clipboard.writeText(window.location.href);
      message.success('链接已复制到剪贴板');
    } catch {
      message.error('分享失败，请稍后再试');
    }
  };

  const handleCommentReaction = async (commentId, type) => {
    if (!requireAuth()) return;
    try {
      const res = await reactToForumComment(commentId, { type, action: 'toggle' });
      setComments((prev) =>
        updateCommentTree(prev, commentId, (comment) => ({
          like_count: res.data?.like_count ?? comment.like_count,
          favorite_count: res.data?.favorite_count ?? comment.favorite_count,
          user_reactions: { ...comment.user_reactions, [type]: res.data?.active ?? false },
        }))
      );
    } catch {
      message.error('操作失败，请稍后再试');
    }
  const handleShare = () => {
    if (!post) return;
    setShareModalVisible(true);
  };

  const handleReplyClick = (comment) => {
    if (!requireAuth()) return;
    setReplyTarget(comment);
  };

  const handleCancelReply = async () => {
    await cleanupReplyUploads();
    setReplyTarget(null);
  };

  const handleReplySubmit = async (values) => {
    const content = values.content?.trim();
    if (!content) {
      message.warning('请输入回复内容');
      return;
    }
    if (!requireAuth()) return;
    if (replyAttachments.some((item) => item.status === 'uploading')) {
      message.warning('请等待图片上传完成后再提交回复');
      return;
    }
    setSubmitting(true);
    try {
      const attachmentIds = replyAttachments.map((item) => item.response?.id).filter(Boolean);
      const payload = { content };
      if (replyTarget) payload.parent_id = replyTarget.id;
      if (attachmentIds.length) payload.attachment_ids = attachmentIds;
      const res = await createForumComment(id, payload);
      const created = normalizeComment(res.data);
      setComments((prev) => appendComment(prev, replyTarget?.id, created));
      setPost((prev) =>
        prev
          ? { ...prev, comment_count: (prev.comment_count || 0) + 1, last_activity_at: created.created_at ?? prev.last_activity_at }
          : prev
      );
      form.resetFields();
      setReplyTarget(null);
      setReplyAttachments([]);
      message.success('回复成功');
    } catch {
      message.error('回复失败，请稍后再试');
    } finally {
      setSubmitting(false);
    }
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
        <Button type="primary" onClick={() => navigate('/forum')}>返回论坛</Button>
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
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/forum')}>返回论坛</Button>
        </Col>
        <Col>
          <Space>
            <Tooltip title={post.user_reactions?.like ? '取消点赞' : '点赞'}>
              <Button type={post.user_reactions?.like ? 'primary' : 'default'} icon={<LikeOutlined />} onClick={() => handleReactToPost('like')}>
                点赞 ({post.like_count ?? 0})
              </Button>
            </Tooltip>
            <Tooltip title={post.user_reactions?.favorite ? '取消收藏' : '收藏'}>
              <Button type={post.user_reactions?.favorite ? 'primary' : 'default'} icon={<StarOutlined />} onClick={() => handleReactToPost('favorite')}>
                收藏 ({post.favorite_count ?? 0})
              </Button>
            </Tooltip>
            <Tooltip title="复制帖子链接">
              <Button icon={<ShareAltOutlined />} onClick={handleShare}>分享 ({post.share_count ?? 0})</Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            {post.category?.name && <Tag color="blue">{post.category.name}</Tag>}
            {(post.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
            {post.is_sticky && <Tag color="red">置顶</Tag>}
          </Space>
        </div>

        <Title level={2} style={{ marginBottom: 16 }}>{post.title}</Title>

        <div style={{ marginBottom: 24 }}>
          <Space size="middle" align="start">
            <Avatar src={post.author?.avatar} size="large" icon={<UserOutlined />} />
            <div>
              <div><Text strong>{post.author?.username || '匿名用户'}</Text></div>
              <div>
                <Text type="secondary">
                  <ClockCircleOutlined /> {formatDateTime(post.created_at)} ·{' '}
                  <EyeOutlined style={{ marginLeft: 8 }} /> {post.view_count ?? 0} 浏览 ·{' '}
                  <MessageOutlined style={{ marginLeft: 8 }} /> {post.comment_count ?? 0} 回复
                </Text>
              </div>
              {post.author?.description && <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>{post.author.description}</Text>}
            </div>
          </Space>
        </div>

        <Paragraph style={{ fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>{post.content}</Paragraph>

        {post.attachments?.length ? (
          <Image.PreviewGroup>
            <Space wrap size="small" style={{ marginBottom: 24 }}>
              {post.attachments.map((att) => <Image key={att.id} src={att.url} width={180} height={180} style={{ objectFit: 'cover', borderRadius: 8 }} alt="帖子附件" />)}
            </Space>
          </Image.PreviewGroup>
        ) : null}

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Title level={4}>{post.comment_count ?? flattenedComments.length} 条回复</Title>
        </div>

        {commentsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={flattenedComments}
            locale={{ emptyText: '还没有人回复，快来抢沙发吧~' }}
            renderItem={(comment) => (
              <List.Item key={comment.id} style={{ paddingLeft: comment.indent * 24 }} actions={comment.is_deleted ? [] : [
                <Button key="like" type={comment.user_reactions?.like ? 'link' : 'text'} icon={<LikeOutlined />} onClick={() => handleCommentReaction(comment.id, 'like')}>
                  {comment.like_count ?? 0}
                </Button>,
                <Button key="reply" type="link" onClick={() => handleReplyClick(comment)}>回复</Button>,
              ]}>
                <List.Item.Meta
                  avatar={<Avatar src={comment.author?.avatar} size="large" icon={<UserOutlined />} />}
                  title={<Space size="small"><Text strong>{comment.author?.username || '匿名用户'}</Text>{comment.is_author && <Tag color="blue">楼主</Tag>}<Text type="secondary">{formatDateTime(comment.created_at)}</Text></Space>}
                  description={
                    <div>
                      <Paragraph style={{ margin: 0, fontSize: '15px', lineHeight: '1.6' }}>{comment.is_deleted ? '该评论已被删除' : comment.content}</Paragraph>
                      {!comment.is_deleted && comment.attachments?.length ? (
                        <Space wrap size="small" style={{ marginTop: 12 }}>
                          {comment.attachments.map((att) => <Image key={att.id} src={att.url} width={140} height={140} style={{ objectFit: 'cover', borderRadius: 6 }} alt="评论附件" />)}
                        </Space>
                      ) : null}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}

        <Divider />

        <div style={{ marginTop: 32 }}>
          <Title level={5}>发表回复</Title>
          {replyTarget && (
            <Tag color="blue" closable onClose={(e) => { e.preventDefault(); handleCancelReply(); }} style={{ marginBottom: 12 }}>
              回复 @{replyTarget.author?.username || '匿名用户'}
            </Tag>
          )}
          <Form form={form} onFinish={handleReplySubmit} layout="vertical">
            <Form.Item name="content" rules={[{ required: true, message: '请输入回复内容' }]}>
              <TextArea rows={6} placeholder="请输入你的回复..." showCount maxLength={2000} />
            </Form.Item>
            <Form.Item label="图片附件">
              <Upload
                name="file"
                listType="picture-card"
                fileList={replyAttachments}
                customRequest={handleReplyUpload}
                beforeUpload={beforeReplyUpload}
                onRemove={handleReplyRemove}
              >
                {replyAttachments.length >= maxReplyAttachments ? null : replyUploadButton}
              </Upload>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>提交回复</Button>
                {replyTarget && <Button onClick={handleCancelReply}>取消回复</Button>}
              </Space>
            </Form.Item>
          </Form>
        </div>
      </Card>
    </div>
  );
}
