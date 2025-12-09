import React, { useContext, useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Typography, Popconfirm, Tabs, List, Avatar, Tag, Spin, Tooltip } from 'antd';
import { InboxOutlined, UserOutlined, MessageOutlined, EyeOutlined, LikeOutlined, StarOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext.jsx';
import { updateProfile, changePassword, getFollowList, getPrivateChatThreads } from '../api/users.js';
import { getMyFavoritePosts, getMyHistoryPosts, getMyLikedPosts, getMyComments } from '../api/forum.js';
import { resolveMediaUrl } from '../utils/media.js';
import { formatDateTime } from '../utils/time.js';
import FollowButton from '../components/FollowButton.jsx';
import PrivateChatDrawer from '../components/PrivateChatDrawer.jsx';

const { Dragger } = Upload;

export default function UserCenter() {
  const navigate = useNavigate();
  const { user, refreshProfile, logout } = useContext(AuthContext);
  const [profileForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  // 我的内容相关状态
  const [activeTab, setActiveTab] = useState('profile');
  const [favoritePosts, setFavoritePosts] = useState([]);
  const [historyPosts, setHistoryPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [likedComments, setLikedComments] = useState([]);
  const [myComments, setMyComments] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [socialFollowTab, setSocialFollowTab] = useState('following');
  const [followLists, setFollowLists] = useState({
    following: { items: [], count: 0, loading: false, loaded: false },
    followers: { items: [], count: 0, loading: false, loaded: false },
    mutual: { items: [], count: 0, loading: false, loaded: false },
  });
  const [chatThreadsState, setChatThreadsState] = useState({ items: [], loading: false, loaded: false });
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ username: user.username, description: user.description || '', avatar: user.avatar || '' });
    }
  }, [user, profileForm]);

  const handleProfileSubmit = async (values) => {
    setSavingProfile(true);
    try {
      const payload = { ...values };
      const fileObj = Array.isArray(values.avatar_file) && values.avatar_file.length > 0
        ? values.avatar_file[0].originFileObj
        : null;
      if (fileObj) {
        payload.avatar_file = fileObj;
      }
      await updateProfile(payload);
      message.success('资料已更新');
      await refreshProfile();
    } catch (e) {
      message.error(e.response?.data?.detail || '更新失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (values) => {
    setChangingPwd(true);
    try {
      await changePassword(values.current_password, values.new_password);
      message.success('密码修改成功，请重新登录');
    } catch (e) {
      message.error(e.response?.data?.detail || '修改失败');
    } finally {
      setChangingPwd(false);
      pwdForm.resetFields();
    }
  };

  // 加载我的收藏
  const loadFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const res = await getMyFavoritePosts();
      setFavoritePosts(res.data || []);
    } catch (e) {
      message.error('加载收藏失败');
    } finally {
      setLoadingFavorites(false);
    }
  };

  // 加载浏览历史
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getMyHistoryPosts();
      setHistoryPosts(res.data || []);
    } catch (e) {
      message.error('加载历史失败');
    } finally {
      setLoadingHistory(false);
    }
  };

  // 加载点赞过的帖子和评论
  const loadLikes = async () => {
    setLoadingLikes(true);
    try {
      const res = await getMyLikedPosts();
      setLikedPosts(res.data?.posts || []);
      setLikedComments(res.data?.comments || []);
    } catch (e) {
      message.error('加载点赞失败');
    } finally {
      setLoadingLikes(false);
    }
  };

  // 加载我的评论
  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const res = await getMyComments();
      setMyComments(res.data || []);
    } catch (e) {
      message.error('加载评论失败');
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchFollowList = useCallback(async (mode, { force = false } = {}) => {
    if (!user) return;
    setFollowLists((prev) => {
      const current = prev[mode] || { items: [], count: 0, loading: false, loaded: false };
      if (!force && current.loading) {
        return prev;
      }
      return {
        ...prev,
        [mode]: { ...current, loading: true },
      };
    });
    try {
      const res = await getFollowList(mode);
      const data = res?.data || {};
      const items = Array.isArray(data.results) ? data.results : [];
      const count = data.count ?? items.length;
      setFollowLists((prev) => ({
        ...prev,
        [mode]: {
          items,
          count,
          loading: false,
          loaded: true,
        },
      }));
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || '加载关注列表失败';
      message.error(detail);
      setFollowLists((prev) => ({
        ...prev,
        [mode]: {
          ...(prev[mode] || { items: [], count: 0 }),
          loading: false,
          loaded: prev[mode]?.loaded || false,
        },
      }));
    }
  }, [user]);

  const loadChatThreads = useCallback(async ({ force = false } = {}) => {
    if (!user) return;
    setChatThreadsState((prev) => {
      if (!force && prev.loading) {
        return prev;
      }
      return { ...prev, loading: true };
    });
    try {
      const res = await getPrivateChatThreads();
      const data = res?.data || {};
      const items = Array.isArray(data.results) ? data.results : [];
      setChatThreadsState({ items, loading: false, loaded: true });
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || '加载私聊列表失败';
      message.error(detail);
      setChatThreadsState((prev) => ({ ...prev, loading: false }));
    }
  }, [user]);

  const handleOpenChat = useCallback((targetUserInfo) => {
    if (!targetUserInfo?.id) {
      message.warning('无法打开私聊，缺少用户信息');
      return;
    }
    setChatTarget({
      id: targetUserInfo.id,
      username: targetUserInfo.username,
      avatar_url: targetUserInfo.avatar_url || targetUserInfo.avatar || '',
      avatar: targetUserInfo.avatar,
      description: targetUserInfo.description,
    });
    setChatDrawerOpen(true);
  }, []);

  const handleFollowStatusChangeFromList = useCallback((mode) => (nextStatus, meta) => {
    if (meta?.reason !== 'update') {
      return;
    }
    fetchFollowList('following', { force: true });
    fetchFollowList('followers', { force: true });
    fetchFollowList('mutual', { force: true });
    loadChatThreads({ force: true });
  }, [fetchFollowList, loadChatThreads]);

  const handleMessageSent = useCallback(() => {
    loadChatThreads({ force: true });
  }, [loadChatThreads]);

  const handleChatDrawerClose = useCallback(() => {
    setChatDrawerOpen(false);
    setChatTarget(null);
  }, []);

  // 标签切换时加载数据
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'favorites' && favoritePosts.length === 0) {
      loadFavorites();
    } else if (activeTab === 'history' && historyPosts.length === 0) {
      loadHistory();
    } else if (activeTab === 'likes' && likedPosts.length === 0 && likedComments.length === 0) {
      loadLikes();
    } else if (activeTab === 'comments' && myComments.length === 0) {
      loadComments();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== 'social' || !user) {
      return;
    }
    const current = followLists[socialFollowTab];
    if (current && !current.loaded && !current.loading) {
      fetchFollowList(socialFollowTab);
    }
    if (!followLists.mutual.loaded && !followLists.mutual.loading) {
      fetchFollowList('mutual');
    }
    if (!chatThreadsState.loaded && !chatThreadsState.loading) {
      loadChatThreads();
    }
  }, [activeTab, socialFollowTab, user, followLists, chatThreadsState, fetchFollowList, loadChatThreads]);

  // 渲染帖子列表
  const renderPostList = (posts, loading) => (
    <Spin spinning={loading}>
      {posts.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>暂无内容</div>
      ) : (
        <List
          itemLayout="vertical"
          dataSource={posts}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/forum/post/${item.id}`)}
              actions={[
                <Space key="comments"><MessageOutlined /> {item.comments_count || 0}</Space>,
                <Space key="views"><EyeOutlined /> {item.views || 0}</Space>,
                <Space key="likes"><LikeOutlined /> {item.likes_count || 0}</Space>,
                <Space key="favorites"><StarOutlined /> {item.favorites_count || 0}</Space>,
              ]}
              extra={
                item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt="帖子预览图"
                    style={{ width: 120, height: 86, objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/forum/post/${item.id}`); }}
                  />
                ) : null
              }
            >
              <List.Item.Meta
                avatar={<Avatar src={resolveMediaUrl(item.author?.avatar)} icon={<UserOutlined />} />}
                title={item.title}
                description={
                  <Space direction="vertical" size={4}>
                    <Typography.Text type="secondary">
                      由 {item.author?.username || '匿名'} 发布于 {formatDateTime(item.created_at)}
                    </Typography.Text>
                    {/* 兼容不同后端字段：category 或 category_obj */}
                    {item.category_obj?.name ? (
                      <Tag color="blue">{item.category_obj.name}</Tag>
                    ) : item.category ? (
                      <Tag color="blue">{item.category}</Tag>
                    ) : null}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Spin>
  );

  // 渲染评论列表（支持跳转到上下文并高亮）
  const renderCommentList = (comments, loading, showPostInfo = true) => (
    <Spin spinning={loading}>
      {comments.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>暂无评论</div>
      ) : (
        <List
          itemLayout="vertical"
          dataSource={comments}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/forum/post/${item.post}#comment-${item.id}`)}
              actions={[
                <Space key="likes"><LikeOutlined /> {item.likes_count || 0}</Space>,
                <Space key="time"><ClockCircleOutlined /> {formatDateTime(item.created_at)}</Space>,
              ]}
            >
              <List.Item.Meta
                description={
                  <div>
                    <Typography.Paragraph ellipsis={{ rows: 3 }}>{item.content}</Typography.Paragraph>
                    {showPostInfo && <Typography.Text type="secondary">评论于帖子 #{item.post}</Typography.Text>}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Spin>
  );

  const renderFollowList = (mode) => {
    const state = followLists[mode] || { items: [], loading: false, loaded: false, count: 0 };
    return (
      <Spin spinning={state.loading}>
        <List
          itemLayout="horizontal"
          dataSource={state.items}
          locale={{ emptyText: state.loading ? '加载中...' : '暂无数据' }}
          renderItem={(item) => {
            const userInfo = item.user || {};
            const isSelf = Boolean(user && user.id === userInfo.id);
            const avatar = resolveMediaUrl(userInfo.avatar_url || userInfo.avatar);
            const actions = [];
            if (!isSelf && userInfo.id) {
              const initialForButton = {
                following: mode === 'following' || item.is_mutual,
                followed_by_target: mode === 'followers' || item.is_mutual,
                mutual: item.is_mutual,
              };
              actions.push(
                <FollowButton
                  key={`follow-${userInfo.id}`}
                  targetUserId={userInfo.id}
                  size="small"
                  onStatusChange={handleFollowStatusChangeFromList(mode)}
                  initialStatus={initialForButton}
                />
              );
            }
            actions.push(
              <Tooltip
                key={`chat-${userInfo.id || item.since}`}
                title={item.is_mutual ? '打开私聊' : '仅互相关注的好友可私聊'}
              >
                <Button
                  size="small"
                  icon={<MessageOutlined />}
                  disabled={!item.is_mutual}
                  onClick={() => item.is_mutual && handleOpenChat(userInfo)}
                >
                  私聊
                </Button>
              </Tooltip>
            );

            return (
              <List.Item key={userInfo.id || item.since} actions={actions}>
                <List.Item.Meta
                  avatar={<Avatar src={avatar} icon={<UserOutlined />} />}
                  title={
                    <Space size="small">
                      <span>{userInfo.username || '用户'}</span>
                      {item.direction === 'following' ? (
                        <Tag color="blue">我关注的</Tag>
                      ) : (
                        <Tag color="purple">关注我的</Tag>
                      )}
                      {item.is_mutual ? <Tag color="green">互相关注</Tag> : null}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {userInfo.description ? (
                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                          {userInfo.description}
                        </Typography.Paragraph>
                      ) : null}
                      <Typography.Text type="secondary">
                        关注时间：{formatDateTime(item.since)}
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Spin>
    );
  };

  const renderChatThreads = () => (
    <Spin spinning={chatThreadsState.loading}>
      {chatThreadsState.items.length === 0 && !chatThreadsState.loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>暂无私聊记录</div>
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={chatThreadsState.items}
          renderItem={(thread) => {
            const partner = thread.partner || {};
            const avatar = resolveMediaUrl(partner.avatar_url || partner.avatar);
            return (
              <List.Item
                key={thread.thread_id}
                actions={[
                  <Button
                    key={`open-${thread.thread_id}`}
                    size="small"
                    icon={<MessageOutlined />}
                    onClick={() => handleOpenChat(partner)}
                  >
                    打开私聊
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar src={avatar} icon={<UserOutlined />} />}
                  title={
                    <Space size="small">
                      <span>{partner.username || '好友'}</span>
                      {thread.unread_count > 0 ? <Tag color="red">未读 {thread.unread_count}</Tag> : null}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {thread.latest_message?.content ? (
                        <Typography.Text
                          ellipsis={{ rows: 2, tooltip: thread.latest_message.content }}
                          style={{ maxWidth: '100%' }}
                        >
                          {thread.latest_message.content}
                        </Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">暂无最新消息</Typography.Text>
                      )}
                      <Typography.Text type="secondary">
                        最近更新：{formatDateTime(thread.updated_at)}
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Spin>
  );

  // 通知功能已迁出到顶部铃铛组件,此页不再包含通知模块

  if (!user) {
    return <Card>请先登录后再访问用户中心。</Card>;
  }

  const tabItems = [
    {
      key: 'profile',
      label: '个人资料',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card title="编辑资料" bordered>
            <Form layout="vertical" form={profileForm} onFinish={handleProfileSubmit}>
              <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少3个字符' }]}>
                <Input maxLength={32} />
              </Form.Item>
              <Form.Item label="简介" name="description">
                <Input.TextArea rows={3} maxLength={300} showCount />
              </Form.Item>
              <Form.Item label="外部头像URL" name="avatar" tooltip="如果填写将使用外链头像，上传文件将覆盖此设置">
                <Input placeholder="https://example.com/avatar.png" />
              </Form.Item>
              <Form.Item
                label="上传新头像"
                name="avatar_file"
                valuePropName="fileList"
                getValueFromEvent={(e) => {
                  if (Array.isArray(e)) return e;
                  return e && e.fileList ? e.fileList.slice(-1) : [];
                }}
              >
                <Dragger
                  multiple={false}
                  maxCount={1}
                  beforeUpload={() => false}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽图片到此处上传</p>
                  <p className="ant-upload-hint">仅支持常见图片格式，大小建议 &lt; 2MB</p>
                </Dragger>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={savingProfile}>保存资料</Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="修改密码" bordered>
            <Form layout="vertical" form={pwdForm} onFinish={handlePasswordSubmit}>
              <Form.Item label="当前密码" name="current_password" rules={[{ required: true, message: '请输入当前密码' }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item label="新密码" name="new_password" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少6个字符' }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item label="确认新密码" name="confirm" dependencies={["new_password"]} rules={[{ required: true, message: '请确认新密码' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('new_password') === value) { return Promise.resolve(); } return Promise.reject(new Error('两次输入不一致')); } })]}>
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={changingPwd}>修改密码</Button>
              </Form.Item>
            </Form>
          </Card>

          <Card bordered>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">安全操作</Typography.Text>
              <Popconfirm title="确认退出登录？" okText="确认" cancelText="取消" onConfirm={() => { logout(); message.success('已退出'); }}>
                <Button danger>退出登录</Button>
              </Popconfirm>
            </Space>
          </Card>
        </Space>
      ),
    },
    {
      key: 'social',
      label: '关注与私聊',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card
            title="关注列表"
            bordered
            extra={(
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchFollowList('following', { force: true });
                  fetchFollowList('followers', { force: true });
                  fetchFollowList('mutual', { force: true });
                }}
              >
                刷新
              </Button>
            )}
          >
            <Tabs
              size="small"
              activeKey={socialFollowTab}
              onChange={(key) => {
                setSocialFollowTab(key);
                if (!followLists[key]?.loaded) {
                  fetchFollowList(key);
                }
              }}
              items={[
                {
                  key: 'following',
                  label: `我关注的人 (${followLists.following.count})`,
                  children: renderFollowList('following'),
                },
                {
                  key: 'followers',
                  label: `关注我的人 (${followLists.followers.count})`,
                  children: renderFollowList('followers'),
                },
                {
                  key: 'mutual',
                  label: `互相关注 (${followLists.mutual.count})`,
                  children: renderFollowList('mutual'),
                },
              ]}
            />
          </Card>
          <Card
            title="私聊消息"
            bordered
            extra={(
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => loadChatThreads({ force: true })}
                loading={chatThreadsState.loading}
              >
                刷新
              </Button>
            )}
          >
            {renderChatThreads()}
          </Card>
        </Space>
      ),
    },
    {
      key: 'favorites',
      label: '我的收藏',
      children: renderPostList(favoritePosts, loadingFavorites),
    },
    {
      key: 'history',
      label: '浏览历史',
      children: renderPostList(historyPosts, loadingHistory),
    },
    {
      key: 'likes',
      label: '我赞过的',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {likedPosts.length > 0 && (
            <div>
              <Typography.Title level={5}>点赞的帖子</Typography.Title>
              {renderPostList(likedPosts, loadingLikes)}
            </div>
          )}
          {likedComments.length > 0 && (
            <div>
              <Typography.Title level={5}>点赞的评论</Typography.Title>
              {renderCommentList(likedComments, loadingLikes, true)}
            </div>
          )}
          {likedPosts.length === 0 && likedComments.length === 0 && !loadingLikes && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>暂无点赞</div>
          )}
          {loadingLikes && (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <Spin size="large" />
            </div>
          )}
        </Space>
      ),
    },
    {
      key: 'comments',
      label: '我的评论',
      children: renderCommentList(myComments, loadingComments, true),
    },
  ];

  return (
    <>
      <Card title="用户中心">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
      <PrivateChatDrawer
        open={chatDrawerOpen}
        targetUser={chatTarget}
        onClose={handleChatDrawerClose}
        onMessageSent={handleMessageSent}
      />
    </>
  );
}
