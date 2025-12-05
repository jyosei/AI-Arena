import React, { useContext, useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Typography, Popconfirm, Tabs, List, Avatar, Tag, Spin } from 'antd';
import { InboxOutlined, UserOutlined, MessageOutlined, EyeOutlined, LikeOutlined, StarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext.jsx';
import { updateProfile, changePassword } from '../api/users.js';
import { getMyFavoritePosts, getMyHistoryPosts, getMyLikedPosts, getMyComments } from '../api/forum.js';
import { resolveMediaUrl } from '../utils/media.js';
import { formatDateTime } from '../utils/time.js';

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

  // 渲染帖子列表
  const renderPostList = (posts, loading) => (
    <Spin spinning={loading}>
      {posts.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>暂无内容</div>
      ) : (
        <List
          itemLayout="vertical"
          dataSource={posts}
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 4 }}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              className="card-hover"
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
                    src={resolveMediaUrl(item.thumbnail)}
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
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 4 }}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              className="card-hover"
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

  // 通知功能已迁出到顶部铃铛组件,此页不再包含通知模块

  if (!user) {
    return (
      <div className="container">
        <Card bordered>请先登录后再访问用户中心。</Card>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'profile',
      label: '个人资料',
      children: (
        <div style={{ width: '100%' }}>
          {/* 单列（移动端）/ 双列（桌面端）由 .user-center-grid 控制 */}
          <div className="user-center-grid">
            <div>
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
            </div>
            <div>
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
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <Card bordered>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Typography.Text type="secondary">安全操作</Typography.Text>
                  <Popconfirm title="确认退出登录？" okText="确认" cancelText="取消" onConfirm={() => { logout(); message.success('已退出'); navigate('/'); }}>
                    <Button danger>退出登录</Button>
                  </Popconfirm>
                </Space>
              </Card>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'favorites',
      label: '我的收藏',
      children: (<div style={{ width: '100%' }}>{renderPostList(favoritePosts, loadingFavorites)}</div>),
    },
    {
      key: 'history',
      label: '浏览历史',
      children: (<div style={{ width: '100%' }}>{renderPostList(historyPosts, loadingHistory)}</div>),
    },
    {
      key: 'likes',
      label: '我赞过的',
      children: (
        <div style={{ width: '100%' }}>
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
        </div>
      ),
    },
    {
      key: 'comments',
      label: '我的评论',
      children: (<div style={{ width: '100%' }}>{renderCommentList(myComments, loadingComments, true)}</div>),
    },
  ];

  return (
    <div className="container">
      <Card title="用户中心" bordered>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
}
