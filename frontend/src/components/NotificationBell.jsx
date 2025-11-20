import React from 'react';
import { Badge, Button, List, Popover, Space, Typography, Avatar } from 'antd';
import { BellOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import AuthContext from '../contexts/AuthContext.jsx';
import { markNotificationRead, markAllNotificationsRead } from '../api/users';
import { useNavigate } from 'react-router-dom';
import { resolveMediaUrl } from '../utils/media';

const { Text, Paragraph } = Typography;

export default function NotificationBell() {
  const { notifications = [], unreadCount = 0, loadNotifications } = React.useContext(AuthContext);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  const navigate = useNavigate();

  const onOpenChange = async (value) => {
    setOpen(value);
    if (value) {
      await refresh();
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await loadNotifications();
    } finally {
      setLoading(false);
    }
  };

  const onMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      await loadNotifications();
    } catch (_) {}
  };

  const goToTarget = async (item) => {
    const postId = item.post ?? item.post_id;
    const commentId = item.comment ?? item.comment_id;
    if (postId) {
      const url = commentId ? `/forum/post/${postId}#comment-${commentId}` : `/forum/post/${postId}`;
      navigate(url);
      setOpen(false);
      if (!item.is_read) {
        try { await markNotificationRead(item.id); await loadNotifications(); } catch (_) {}
      }
    }
  };

  const onMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      await loadNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const content = (
    <div style={{ width: 360 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>通知</Text>
        <Space size="small">
          <Button size="small" icon={<ReloadOutlined />} onClick={refresh} loading={loading}>刷新</Button>
          <Button size="small" onClick={onMarkAll} icon={<CheckOutlined />} loading={markingAll}>全部已读</Button>
        </Space>
      </div>
      <List
        size="small"
        dataSource={notifications}
        locale={{ emptyText: '暂无通知' }}
        style={{ maxHeight: 400, overflowY: 'auto' }}
        renderItem={(item) => (
          <List.Item
            style={{ opacity: item.is_read ? 0.6 : 1, padding: '8px 0', cursor: item.post ? 'pointer' : 'default' }}
            onClick={() => goToTarget(item)}
            actions={[
              !item.is_read ? <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); onMarkRead(item.id); }}>已读</Button> : null,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar size={28} src={resolveMediaUrl(item.actor_avatar_url)} />}
              title={
                <Paragraph style={{ marginBottom: 4 }} ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}>
                  {item.message}
                </Paragraph>
              }
              description={
                <Space size={4} direction="vertical" style={{ width: '100%' }}>
                  {item.post_title ? <Text type="secondary">帖子：{item.post_title}</Text> : null}
                  {item.comment_excerpt ? <Text type="secondary">评论：{item.comment_excerpt}</Text> : null}
                  <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={onOpenChange}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[ -2, 6 ]} overflowCount={99}>
        <Button shape="circle" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  );
}
