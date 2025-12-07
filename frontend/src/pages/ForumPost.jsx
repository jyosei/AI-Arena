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
  Popconfirm,
  Popover,
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
  DeleteOutlined,
  PictureOutlined,
  SmileOutlined,
  CloseOutlined,
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
  deleteForumPost,
  deleteForumComment,
} from '../api/forum';
import ShareModal from '../components/ShareModal';
import { getPublicOrigin } from '../utils/media';
import { formatDateTime } from '../utils/time.js';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const COMMENT_EMOJI_GROUPS = [
  {
    label: '常用',
    emojis: ['😀', '😂', '😊', '😍', '😉', '😎', '🤔', '😭'],
  },
  {
    label: '态度',
    emojis: ['👍', '👎', '👏', '🙏', '🙌', '🤝', '💪', '🤗'],
  },
  {
    label: '热度',
    emojis: ['🎉', '🔥', '⚡', '🌟', '🚀', '🌈', '✨', '🥳'],
  },
  {
    label: '趣味',
    emojis: ['🤖', '🐱', '🐶', '🦄', '🍀', '🍕', '☕', '🎮'],
  },
];

// 将评论树展平，用于列表显示（支持折叠）
const flattenComments = (items, depth = 0, collapsedSet = new Set(), parentFloor = 0, parentAuthor = null, rootComment = null) => {
  let currentFloor = parentFloor;
  return items.flatMap((comment) => {
    // 只有一级评论才有楼层号
    if (depth === 0) {
      currentFloor++;
      rootComment = comment;
    }
    const children = comment.children || [];
    
    // 计算当前评论树的最大深度
    const calculateDepth = (c, d = 0) => {
      if (!c.children || c.children.length === 0) return d;
      return Math.max(...c.children.map(child => calculateDepth(child, d + 1)));
    };
    
    // 计算所有子孙评论的总数量
    const countAllChildren = (c) => {
      if (!c.children || c.children.length === 0) return 0;
      return c.children.length + c.children.reduce((sum, child) => sum + countAllChildren(child), 0);
    };
    
    const maxDepth = depth === 0 ? calculateDepth(comment) : 0;
    const totalChildCount = depth === 0 ? countAllChildren(comment) : 0;
    
    const current = {
      ...comment,
      indent: depth > 0 ? 1 : 0, // 只缩进一次，楼中楼都是相同缩进
      floor: depth === 0 ? currentFloor : parentFloor,
      childCount: children.length,
      totalChildCount: totalChildCount, // 所有子孙评论的总数量
      maxDepth: maxDepth, // 记录最大深度
      rootCommentId: rootComment?.id, // 记录所属的一级评论ID
      replyTo: depth > 0 ? parentAuthor : null, // 记录回复的目标用户
      user_reactions: {
        like: false,
        favorite: false,
        ...(comment.user_reactions || {}),
      },
      attachments: comment.attachments || [],
    };
    // 如果当前评论被折叠，不展开子评论
    if (collapsedSet.has(comment.id)) {
      return [current];
    }
    // 传递当前评论作者给子评论，作为回复目标
    return [current, ...flattenComments(children, depth + 1, collapsedSet, depth === 0 ? currentFloor : parentFloor, comment.author, rootComment)];
  });
};

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

const removeComment = (items = [], targetId) => {
  const traverse = (list) => {
    let changed = false;
    const result = [];

    list.forEach((item) => {
      if (item.id === targetId) {
        changed = true;
        return;
      }

      let childrenState = { list: item.children, changed: false };
      if (item.children?.length) {
        childrenState = traverse(item.children);
      }

      if (childrenState.changed) {
        changed = true;
        result.push({ ...item, children: childrenState.list || [] });
      } else {
        result.push(item);
      }
    });

    if (!changed && result.length === list.length) {
      return { list, changed: false };
    }

    return { list: result, changed: changed || result.length !== list.length };
  };

  const { list: finalList, changed } = traverse(Array.isArray(items) ? items : []);
  return changed ? finalList : items;
};

const countCommentDescendants = (comment) => {
  const children = comment?.children || [];
  return children.reduce((total, child) => total + 1 + countCommentDescendants(child), 0);
};

const collectCommentIds = (comment) => {
  if (!comment) return [];
  const children = comment.children || [];
  return [comment.id, ...children.flatMap((child) => collectCommentIds(child))];
};

const getCategoryMeta = (category) => {
  if (category == null) return { key: '', label: '' };
  if (typeof category === 'string') return { key: category, label: category };
  if (typeof category === 'number') return { key: category, label: String(category) };
  if (typeof category === 'object') {
    const key = category.id ?? category.slug ?? category.name ?? JSON.stringify(category);
    const label = category.name ?? category.title ?? category.slug ?? (category.id != null ? `板块 ${category.id}` : '');
    return { key, label };
  }
  return { key: String(category), label: String(category) };
};

const getTagMeta = (tag) => {
  if (tag == null) return { key: '', label: '' };
  if (typeof tag === 'string') return { key: tag, label: tag };
  if (typeof tag === 'number') return { key: tag, label: String(tag) };
  if (typeof tag === 'object') {
    const key = tag.id ?? tag.slug ?? tag.name ?? JSON.stringify(tag);
    const label = tag.name ?? tag.slug ?? (tag.id != null ? `标签 ${tag.id}` : '') ?? '';
    return { key, label };
  }
  return { key: String(tag), label: String(tag) };
};
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
  const [shareModalVisible, setShareModalVisible] = useState(false); // 分享弹窗状态
  const [collapsedComments, setCollapsedComments] = useState(new Set()); // 折叠的评讼ID集合（默认全部展开）
  const topRef = useRef(null);
  const hasInitializedCollapse = useRef(false); // 标记是否已初始化折叠状态
  const textAreaRef = useRef(null);
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);

  // 自动折叠超过3层的楼中楼（仅在首次加载时执行一次）
  useEffect(() => {
    if (comments.length > 0 && !hasInitializedCollapse.current) {
      const toCollapse = new Set();
      const countDepth = (comment, depth = 0) => {
        let maxDepth = depth;
        if (comment.children && comment.children.length > 0) {
          comment.children.forEach(child => {
            const childDepth = countDepth(child, depth + 1);
            maxDepth = Math.max(maxDepth, childDepth);
          });
        }
        return maxDepth;
      };
      
      comments.forEach(comment => {
        const depth = countDepth(comment);
        if (depth >= 3) {
          toCollapse.add(comment.id);
        }
      });
      
      if (toCollapse.size > 0) {
        setCollapsedComments(toCollapse);
      }
      hasInitializedCollapse.current = true; // 标记已初始化
    }
  }, [comments]);

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
    if (replyAttachments.length >= maxReplyAttachments) {
      message.warning(`最多上传 ${maxReplyAttachments} 张图片`);
      return Upload.LIST_IGNORE;
    }
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
  }, [replyAttachments, maxReplyAttachments]);

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
        message.error('图片上传失败,请稍后再试');
      }
    },
    []
  );

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

  const handleEmojiSelect = useCallback(
    (emoji) => {
      const currentValue = form.getFieldValue('content') || '';
      const textAreaInstance = textAreaRef.current?.resizableTextArea?.textArea;
      if (textAreaInstance) {
        const { selectionStart = currentValue.length, selectionEnd = currentValue.length } = textAreaInstance;
        const newValue = `${currentValue.slice(0, selectionStart)}${emoji}${currentValue.slice(selectionEnd)}`;
        form.setFieldsValue({ content: newValue });
        requestAnimationFrame(() => {
          textAreaInstance.focus();
          const cursor = selectionStart + emoji.length;
          textAreaInstance.selectionStart = cursor;
          textAreaInstance.selectionEnd = cursor;
        });
      } else {
        form.setFieldsValue({ content: `${currentValue}${emoji}` });
      }
      setEmojiPopoverOpen(false);
    },
    [form]
  );

  const emojiPickerContent = useMemo(
    () => (
      <div style={{ maxWidth: 260 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {COMMENT_EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>{group.label}</Text>
              <Space size="small" wrap>
                {group.emojis.map((emoji) => (
                  <Button
                    key={`${group.label}-${emoji}`}
                    type="text"
                    onClick={() => handleEmojiSelect(emoji)}
                    style={{ fontSize: 20, width: 40, height: 40, padding: 0 }}
                  >
                    {emoji}
                  </Button>
                ))}
              </Space>
            </div>
          ))}
        </Space>
      </div>
    ),
    [handleEmojiSelect]
  );

  // 加载帖子详情
  const loadPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchForumPostDetail(id);
      const postData = res.data || {};
      if (
        postData.metrics &&
        typeof postData.metrics.share_count === 'number' &&
        typeof postData.share_count !== 'number'
      ) {
        postData.share_count = postData.metrics.share_count;
      }
      const likeActive = postData?.user_reactions?.like ?? Boolean(postData?.is_liked);
      const favoriteActive = postData?.user_reactions?.favorite ?? Boolean(postData?.is_favorited);
      const likeCount =
        typeof postData.like_count === 'number'
          ? postData.like_count
          : typeof postData.likes_count === 'number'
          ? postData.likes_count
          : 0;
      const favoriteCount =
        typeof postData.favorite_count === 'number'
          ? postData.favorite_count
          : typeof postData.favorites_count === 'number'
          ? postData.favorites_count
          : 0;
      const commentCount =
        typeof postData.comment_count === 'number'
          ? postData.comment_count
          : typeof postData.comments_count === 'number'
          ? postData.comments_count
          : 0;
      const categoryValue = postData.category_obj || postData.category || null;
      const normalizedPost = {
        ...postData,
        user_reactions: {
          like: likeActive,
          favorite: favoriteActive,
        },
        is_liked: likeActive,
        is_favorited: favoriteActive,
        like_count: likeCount,
        likes_count: likeCount,
        favorite_count: favoriteCount,
        favorites_count: favoriteCount,
        comment_count: commentCount,
        comments_count: commentCount,
        category: categoryValue,
        category_obj: categoryValue,
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

  const flattenedComments = useMemo(() => flattenComments(comments, 0, collapsedComments), [comments, collapsedComments]);

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
              ...(type === 'like'
                ? { is_liked: res.data?.active ?? false }
                : { is_favorited: res.data?.active ?? false }),
            }
          : prev
      );
    } catch {
      message.error('操作失败，请稍后再试');
    }
  };

  const handleShare = async () => {
    try {
      const res = await shareForumPost(id, { channel: 'web' });
      const shareCount =
        typeof res?.data?.share_count === 'number'
          ? res.data.share_count
          : typeof res?.data?.metrics?.share_count === 'number'
            ? res.data.metrics.share_count
            : null;
      setPost((prev) =>
        prev
          ? {
              ...prev,
              share_count: typeof shareCount === 'number' ? shareCount : (prev.share_count ?? 0) + 1,
            }
          : prev
      );
      setShareModalVisible(true);
      try {
        await navigator.clipboard.writeText(window.location.href);
        message.success('链接已复制到剪贴板');
      } catch {
        message.info('已打开分享面板，可扫码或复制链接');
      }
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
  };

  const handleReplyClick = (comment) => {
    if (!requireAuth()) return;
    setReplyTarget(comment);
  };

  const handleCancelReply = async () => {
    await cleanupReplyUploads();
    setReplyTarget(null);
  };

  // 切换评论折叠状态
  const toggleCommentCollapse = useCallback((commentId) => {
    setCollapsedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);

  const handlePostDelete = useCallback(async () => {
    if (!post?.id) return;
    if (!requireAuth()) return;
    try {
      await deleteForumPost(post.id);
      message.success('帖子已删除');
      navigate('/forum');
    } catch (error) {
      message.error('删除帖子失败，请稍后再试');
    }
  }, [post?.id, requireAuth, navigate]);

  const handleCommentDelete = useCallback(async (comment) => {
    if (!requireAuth()) return;
    try {
      await deleteForumComment(comment.id);
      const descendantCount = countCommentDescendants(comment);
      const removedIds = collectCommentIds(comment);

      setComments((prev) => removeComment(prev, comment.id));
      setPost((prev) => {
        if (!prev) return prev;
        const decrement = 1 + descendantCount;
        const currentCount = typeof prev.comment_count === 'number' ? prev.comment_count : flattenedComments.length;
        const updatedCommentCount = Math.max(currentCount - decrement, 0);
        const updatedCommentsCount =
          typeof prev.comments_count === 'number' ? Math.max(prev.comments_count - decrement, 0) : prev.comments_count;
        return {
          ...prev,
          comment_count: updatedCommentCount,
          comments_count: updatedCommentsCount,
        };
      });

      setCollapsedComments((prev) => {
        if (!prev.size) return prev;
        const hasMatch = removedIds.some((id) => prev.has(id));
        if (!hasMatch) return prev;
        const next = new Set(prev);
        removedIds.forEach((id) => next.delete(id));
        return next;
      });

      if (replyTarget && removedIds.includes(replyTarget.id)) {
        setReplyTarget(null);
      }

      message.success('评论已删除');
    } catch (error) {
      message.error('删除评论失败，请稍后再试');
    }
  }, [requireAuth, replyTarget, flattenedComments.length]);

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
      if (replyTarget) payload.parent = replyTarget.id;
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

  const canManagePost = Boolean(user && (user.id === post.author?.id || user?.is_staff));
  const categoryMeta = getCategoryMeta(post.category || post.category_obj);

  return (
    <div className="forum-post-page">
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
            {canManagePost && (
              <Popconfirm
                title="确定要删除这个帖子吗？"
                okText="删除"
                okType="danger"
                cancelText="取消"
                onConfirm={handlePostDelete}
              >
                <Button danger icon={<DeleteOutlined />}>删除帖子</Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      <Card bordered className="forum-post-card">
        <div style={{ marginBottom: 16 }}>
          <Space size="middle" wrap>
            {categoryMeta.label && (
              <Space size={4}>
                <Text type="secondary">板块</Text>
                <Tag color="blue">{categoryMeta.label}</Tag>
              </Space>
            )}
            {(post.tags || []).length > 0 && (
              <Space size={4} wrap>
                <Text type="secondary">标签</Text>
                {(post.tags || []).map((tag) => {
                  const { key, label } = getTagMeta(tag);
                  if (!label) return null;
                  return <Tag key={key}>#{label}</Tag>;
                })}
              </Space>
            )}
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

        <div className="post-content" style={{ whiteSpace: 'pre-line' }}>{post.content}</div>

        {post.attachments?.length ? (
          <Image.PreviewGroup>
            <Space wrap size="small" style={{ marginBottom: 24 }}>
              {post.attachments.map((att) => <Image key={att.id} src={att.url} width={180} height={180} style={{ objectFit: 'cover', borderRadius: 8 }} alt="帖子附件" />)}
            </Space>
          </Image.PreviewGroup>
        ) : null}

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>{post.comment_count ?? flattenedComments.length} 条回复</Title>
        </div>

        {commentsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={flattenedComments}
            locale={{ emptyText: '还没有人回复，快来抢沙发吧~' }}
            renderItem={(comment) => {
              const isCollapsed = collapsedComments.has(comment.id);
              const showCollapseButton = comment.indent === 0 && comment.maxDepth >= 3;
              const indentStyle = {
                marginLeft: comment.indent * 40,
                borderLeft: comment.indent > 0 ? '2px solid var(--border)' : 'none',
                paddingLeft: comment.indent > 0 ? 16 : 0,
                transition: 'all 0.3s ease',
              };
              const canDeleteComment = Boolean(
                user &&
                !comment.is_deleted &&
                (user.id === comment.author?.id || user.id === post.author?.id || user?.is_staff)
              );
              const commentActions = [];

              if (!comment.is_deleted) {
                commentActions.push(
                  <Button
                    key="like"
                    type={comment.user_reactions?.like ? 'primary' : 'text'}
                    size="small"
                    icon={<LikeOutlined />}
                    onClick={() => handleCommentReaction(comment.id, 'like')}
                  >
                    {comment.like_count ?? 0}
                  </Button>
                );

                commentActions.push(
                  <Button key="reply" type="link" size="small" onClick={() => handleReplyClick(comment)}>回复</Button>
                );

                if (canDeleteComment) {
                  commentActions.push(
                    <Popconfirm
                      key={`delete-${comment.id}`}
                      title="确定删除这条评论吗？"
                      okText="删除"
                      okType="danger"
                      cancelText="取消"
                      onConfirm={() => handleCommentDelete(comment)}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                  );
                }
              }
              
              return (
                <>
                  <List.Item 
                    key={comment.id} 
                    style={indentStyle}
                    actions={commentActions}
                  >
                    <List.Item.Meta
                      avatar={<Avatar src={comment.author?.avatar} size={comment.indent > 0 ? 'default' : 'large'} icon={<UserOutlined />} />}
                      title={
                        <Space size="small">
                          <Text strong style={{ fontSize: comment.indent > 0 ? 14 : 15 }}>
                            {comment.author?.username || '匿名用户'}
                          </Text>
                          {comment.is_author && <Tag color="gold">楼主</Tag>}
                          {comment.indent === 0 && <Tag color="blue">#{comment.floor}楼</Tag>}
                          <Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(comment.created_at)}</Text>
                        </Space>
                      }
                      description={
                        <div>
                          <Paragraph style={{ margin: 0, fontSize: comment.indent > 0 ? 14 : 15, lineHeight: '1.6', color: comment.is_deleted ? '#999' : 'inherit' }}>
                            {comment.is_deleted ? '该评论已被删除' : (
                              <>
                                {comment.replyTo && (
                                  <Text type="secondary" style={{ marginRight: 8 }}>
                                    @{comment.replyTo.username || '匿名用户'}
                                  </Text>
                                )}
                                {comment.content}
                              </>
                            )}
                          </Paragraph>
                          {!comment.is_deleted && comment.attachments?.length ? (
                            <Space wrap size="small" style={{ marginTop: 12 }}>
                              {comment.attachments.map((att) => (
                                <Image 
                                  key={att.id} 
                                  src={att.url} 
                                  width={comment.indent > 0 ? 100 : 140} 
                                  height={comment.indent > 0 ? 100 : 140} 
                                  style={{ objectFit: 'cover', borderRadius: 6 }} 
                                  alt="评论附件" 
                                />
                              ))}
                            </Space>
                          ) : null}
                        </div>
                      }
                    />
                  </List.Item>
                  {showCollapseButton && (
                    <div style={{ marginLeft: 40, marginBottom: 16, marginTop: -8 }}>
                      <Button 
                        type="link" 
                        size="small"
                        onClick={() => toggleCommentCollapse(comment.id)}
                      >
                        {isCollapsed ? `展开楼中楼 (${comment.totalChildCount} 条回复)` : '折叠楼中楼'}
                      </Button>
                    </div>
                  )}
                </>
              );
            }}
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
              <TextArea
                ref={textAreaRef}
                rows={6}
                placeholder="请输入你的回复..."
                showCount
                maxLength={2000}
                allowClear
              />
            </Form.Item>
            <Form.Item>
              <Space size="middle" align="center" style={{ marginBottom: replyAttachments.length ? 12 : 0 }}>
                <Upload
                  name="file"
                  accept="image/*"
                  multiple
                  showUploadList={false}
                  fileList={replyAttachments}
                  customRequest={handleReplyUpload}
                  beforeUpload={beforeReplyUpload}
                  onRemove={handleReplyRemove}
                  disabled={replyAttachments.length >= maxReplyAttachments || submitting}
                >
                  <Tooltip title="添加图片">
                    <Button
                      type="text"
                      shape="circle"
                      icon={<PictureOutlined style={{ fontSize: 18 }} />}
                      disabled={replyAttachments.length >= maxReplyAttachments || submitting}
                    />
                  </Tooltip>
                </Upload>
                <Popover
                  content={emojiPickerContent}
                  trigger="click"
                  placement="topLeft"
                  open={emojiPopoverOpen}
                  onOpenChange={setEmojiPopoverOpen}
                >
                  <Tooltip title="插入表情">
                    <Button type="text" shape="circle" icon={<SmileOutlined style={{ fontSize: 18 }} />} />
                  </Tooltip>
                </Popover>
                <Text type="secondary">
                  最多上传 {maxReplyAttachments} 张图片
                </Text>
              </Space>
              {replyAttachments.length > 0 && (
                <Space size="small" wrap>
                  {replyAttachments.map((file) => {
                    const isDone = file.status === 'done';
                    return (
                      <div
                        key={file.uid}
                        style={{
                          position: 'relative',
                          width: 80,
                          height: 80,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          background: '#fafafa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isDone && file.url ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Spin size="small" />
                        )}
                        <Button
                          size="small"
                          type="text"
                          icon={<CloseOutlined />}
                          onClick={() => handleReplyRemove(file)}
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            background: 'rgba(0,0,0,0.45)',
                            color: '#fff',
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                      </div>
                    );
                  })}
                </Space>
              )}
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
