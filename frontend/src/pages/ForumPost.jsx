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
  LikeFilled,
  MessageOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ShareAltOutlined,
  UploadOutlined,
  PictureOutlined,
  SmileOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled
} from '@ant-design/icons';
import { Image } from 'antd';
// 轻量级内置表情面板（镜像源暂不可用第三方依赖）
import { fetchForumPost, createForumComment, toggleForumPostLike, toggleForumCommentLike, toggleForumPostFavorite } from '../api/forum';
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
  const hasScrolledRef = useRef(false); // 是否已滚动到目标评论
  const [highlightCommentId, setHighlightCommentId] = useState(null); // 高亮的评论ID
  const topRef = useRef(null);
  const fileInputRef = useRef(null); // 隐藏文件选择
  const textAreaRef = useRef(null); // TextArea ref
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [activeEmotionTab, setActiveEmotionTab] = useState('经典'); // 当前选中的表情分类

  // 根据 hash 定位评论并高亮
  const scrollToHash = useCallback(() => {
    // 只在首次进入页面（或首次加载完帖子）时滚动一次
    if (hasScrolledRef.current) return;
    const anchor = window.location.hash?.replace('#', '');
    if (anchor && anchor.startsWith('comment-')) {
      const commentId = anchor.replace('comment-', '');
      const el = document.getElementById(anchor);
      if (el) {
        hasScrolledRef.current = true;
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 设置高亮
          setHighlightCommentId(commentId);
          // 3秒后取消高亮
          setTimeout(() => setHighlightCommentId(null), 3000);
        }, 300);
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
    const images = replyImages.map(f => f.originFileObj).filter(Boolean);
    if (!replyContent.trim() && images.length === 0) {
      message.warning('请输入回复内容或上传图片');
      return;
    }
    if (!user) {
      message.warning('请先登录再发表评论');
      return;
    }

    setSubmitting(true);
    try {
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

  const handleFavoritePost = () => {
    if (!user) {
      message.warning('请先登录');
      return;
    }
    if (!post) return;
    toggleForumPostFavorite(post.id)
      .then(res => {
        const { favorited, favorites_count } = res.data;
        setPost(p => (p ? { ...p, is_favorited: favorited, favorites_count } : p));
        message.success(favorited ? '收藏成功' : '取消收藏');
      })
      .catch(() => message.error('操作失败'));
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

  const handleChooseImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const mapped = files.slice(0, 6 - replyImages.length).map((file) => ({
      uid: `${Date.now()}-${file.name}`,
      name: file.name,
      status: 'done',
      originFileObj: file,
      url: URL.createObjectURL(file),
    }));
    setReplyImages((prev) => [...prev, ...mapped]);
    // 清空 input 防止同名文件无法再次选择
    e.target.value = '';
  };

  const handleTextDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dtFiles = Array.from(e.dataTransfer?.files || []);
    const imageFiles = dtFiles.filter(f => /^image\//.test(f.type));
    if (imageFiles.length === 0) return;
    const mapped = imageFiles.slice(0, 6 - replyImages.length).map((file) => ({
      uid: `${Date.now()}-${file.name}`,
      name: file.name,
      status: 'done',
      originFileObj: file,
      url: URL.createObjectURL(file),
    }));
    setReplyImages((prev) => [...prev, ...mapped]);
  };

  const handleTextDragOver = (e) => {
    // 允许放置
    e.preventDefault();
  };

  // 类似贴吧的表情包系统 - 使用文本表情
  const EMOTION_SETS = {
    '经典': [
      { text: '[微笑]', display: '😊' },
      { text: '[撇嘴]', display: '😒' },
      { text: '[色]', display: '😍' },
      { text: '[发呆]', display: '😳' },
      { text: '[得意]', display: '😎' },
      { text: '[流泪]', display: '😢' },
      { text: '[害羞]', display: '😊' },
      { text: '[闭嘴]', display: '🤐' },
      { text: '[睡]', display: '😴' },
      { text: '[大哭]', display: '😭' },
      { text: '[尴尬]', display: '😅' },
      { text: '[发怒]', display: '😠' },
      { text: '[调皮]', display: '😜' },
      { text: '[呲牙]', display: '😁' },
      { text: '[惊讶]', display: '😲' },
      { text: '[难过]', display: '😔' },
      { text: '[酷]', display: '😎' },
      { text: '[冷汗]', display: '😓' },
      { text: '[抓狂]', display: '😤' },
      { text: '[吐]', display: '🤮' },
    ],
    '手势': [
      { text: '[赞]', display: '👍' },
      { text: '[踩]', display: '👎' },
      { text: '[拳头]', display: '👊' },
      { text: '[OK]', display: '👌' },
      { text: '[爱心]', display: '❤️' },
      { text: '[加油]', display: '💪' },
      { text: '[祈祷]', display: '🙏' },
      { text: '[鼓掌]', display: '👏' },
    ],
    '常用': [
      { text: '[火]', display: '🔥' },
      { text: '[星星]', display: '⭐' },
      { text: '[灯泡]', display: '💡' },
      { text: '[炸弹]', display: '💣' },
      { text: '[咖啡]', display: '☕' },
      { text: '[蛋糕]', display: '🎂' },
      { text: '[礼物]', display: '🎁' },
      { text: '[庆祝]', display: '🎉' },
    ]
  };
  
  const insertEmotion = (emotion) => {
    // 插入表情文本标记，如 [微笑]
    setReplyContent((prev) => (prev || '') + emotion.text);
  };

  // 解析评论内容中的表情文本，替换为实际表情符号
  const parseEmotionText = (text) => {
    if (!text) return text;
    
    // 创建所有表情的映射
    const emotionMap = {};
    Object.values(EMOTION_SETS).forEach(emotions => {
      emotions.forEach(emotion => {
        emotionMap[emotion.text] = emotion.display;
      });
    });
    
    // 替换所有表情文本
    let result = text;
    Object.entries(emotionMap).forEach(([textEmotion, display]) => {
      // 转义方括号
      const escapedText = textEmotion.replace(/[[\]]/g, '\\$&');
      const regex = new RegExp(escapedText, 'g');
      result = result.replace(regex, display);
    });
    
    return result;
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
              type="default"
              icon={post.is_liked ? <LikeFilled style={{ color: '#ff4d4f' }} /> : <LikeOutlined />}
              onClick={handleLikePost}
              style={{ color: post.is_liked ? '#ff4d4f' : undefined }}
            >
              点赞 ({post.likes_count || 0})
            </Button>
            <Button 
              type="default"
              icon={post.is_favorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={handleFavoritePost}
              style={{ color: post.is_favorited ? '#faad14' : undefined }}
            >
              收藏 ({post.favorites_count || 0})
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
        <Paragraph style={{ fontSize: '16px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{parseEmotionText(post.content)}</Paragraph>
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
            
            // 判断是否需要高亮
            const isHighlighted = highlightCommentId === String(reply.id);

            return (
              <List.Item
                key={reply.id}
              id={`comment-${reply.id}`}
              className={isHighlighted ? 'comment-highlight' : ''}
              style={{ 
                scrollMarginTop: 80,
                padding: '16px',
                borderRadius: '4px',
              }}
              actions={[
                <Button
                  type="text"
                  icon={reply.is_liked ? <LikeFilled style={{ color: '#ff4d4f' }} /> : <LikeOutlined />}
                  onClick={() => handleCommentLike(reply.id)}
                  style={{ color: reply.is_liked ? '#ff4d4f' : undefined }}
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
                        {parseEmotionText(reply.content)}
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
            <Form.Item
              name="content"
              rules={[
                {
                  validator: async (_, value) => {
                    const hasText = (value || '').trim().length > 0;
                    const hasImages = replyImages.length > 0;
                    if (!hasText && !hasImages) {
                      return Promise.reject(new Error('请输入回复内容或上传图片'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <TextArea
                ref={textAreaRef}
                rows={6}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="请输入你的回复..."
                showCount
                maxLength={3000}
                onDrop={handleTextDrop}
                onDragOver={handleTextDragOver}
              />
            </Form.Item>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Button
                type="text"
                icon={<PictureOutlined />}
                onClick={handleChooseImage}
                title="上传图片"
              />
              <Button
                type="text"
                icon={<SmileOutlined />}
                onClick={() => setShowEmojiPanel(v => !v)}
                title="表情"
              />
            </div>
            {showEmojiPanel && (
              <div style={{ 
                marginBottom: 12, 
                padding: '12px', 
                border: '1px solid #e8e8e8', 
                borderRadius: 8,
                backgroundColor: '#fafafa',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                {/* 表情分类标签 */}
                <div style={{ marginBottom: 12, borderBottom: '1px solid #e8e8e8' }}>
                  <Space size={0}>
                    {Object.keys(EMOTION_SETS).map(tab => (
                      <Button
                        key={tab}
                        type={activeEmotionTab === tab ? 'primary' : 'text'}
                        size="small"
                        onClick={() => setActiveEmotionTab(tab)}
                        style={{ 
                          borderRadius: '4px 4px 0 0',
                          marginBottom: -1,
                          ...(activeEmotionTab === tab ? {} : { border: 'none' })
                        }}
                      >
                        {tab}
                      </Button>
                    ))}
                  </Space>
                </div>
                {/* 表情网格 */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
                  gap: 8,
                  maxHeight: 200,
                  overflowY: 'auto'
                }}>
                  {EMOTION_SETS[activeEmotionTab]?.map(emotion => (
                    <div
                      key={emotion.text}
                      onClick={() => insertEmotion(emotion)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px 4px',
                        cursor: 'pointer',
                        borderRadius: 4,
                        transition: 'all 0.2s',
                        backgroundColor: '#fff',
                        border: '1px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e6f7ff';
                        e.currentTarget.style.borderColor = '#1890ff';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title={emotion.text}
                    >
                      <span style={{ fontSize: 24 }}>{emotion.display}</span>
                      <span style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                        {emotion.text.replace(/[\[\]]/g, '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 隐藏文件选择控件 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFilesSelected}
            />
            {/* 选中图片的缩略图列表 */}
            {replyImages.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Image.PreviewGroup>
                  <Space wrap>
                    {replyImages.map((f) => (
                      <div key={f.uid} style={{ position: 'relative' }}>
                        <Image
                          src={f.url}
                          alt={f.name}
                          width={90}
                          height={90}
                          style={{ objectFit: 'cover', borderRadius: 6 }}
                        />
                        <Button
                          size="small"
                          type="text"
                          onClick={() => setReplyImages(prev => prev.filter(i => i.uid !== f.uid))}
                          style={{ position: 'absolute', top: 4, right: 4, border: '1px solid #fff', color: '#fff', borderRadius: 16, padding: '0 6px', background: 'rgba(0,0,0,0.35)' }}
                          icon={<DeleteOutlined />}
                        />
                      </div>
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </div>
            )}
            <Button type="primary" htmlType="submit" loading={submitting} size="large">发表回复</Button>
          </Form>
        </div>
      </Card>
    </div>
  );
}