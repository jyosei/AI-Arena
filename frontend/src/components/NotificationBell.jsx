import React from 'react';
import { Badge, Button, List, Popover, Space, Typography, Avatar, Grid, Drawer } from 'antd';
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
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md; // 小于 md 视为移动端

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
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
    <div style={{ width: isMobile ? '100%' : 'min(320px, 90vw)' }}>
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong>通知</Text>
          <Space size={4}>
            <Button size="small" icon={<ReloadOutlined />} onClick={refresh} loading={loading}>刷新</Button>
            <Button size="small" onClick={onMarkAll} icon={<CheckOutlined />} loading={markingAll}>全部已读</Button>
          </Space>
        </div>
      )}
      <List
        size="small"
        dataSource={notifications}
        locale={{ emptyText: '暂无通知' }}
        style={{ maxHeight: '50vh', overflowY: 'auto' }}
        renderItem={(item) => (
          <List.Item
            style={{ opacity: item.is_read ? 0.6 : 1, padding: '6px 0', cursor: item.post ? 'pointer' : 'default' }}
            onClick={() => goToTarget(item)}
            actions={[
              !item.is_read ? <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); onMarkRead(item.id); }}>已读</Button> : null,
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar size={24} src={resolveMediaUrl(item.actor_avatar_url)} />}
              title={
                <Paragraph style={{ marginBottom: 2 }} ellipsis={{ rows: 1 }}>
                  {item.message}
                </Paragraph>
              }
              description={
                <Space size={2} direction="vertical" style={{ width: '100%' }}>
                  {item.post_title ? <Text type="secondary">帖子：{item.post_title}</Text> : null}
                  {item.comment_excerpt ? <Text type="secondary">评论：{item.comment_excerpt}</Text> : null}
                  <Text type="secondary" style={{ fontSize: 11 }}>{new Date(item.created_at).toLocaleString()}</Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Badge count={unreadCount} size="small" offset={[ -2, 6 ]} overflowCount={99}>
          <Button shape="circle" icon={<BellOutlined />} onClick={toggleOpen} />
        </Badge>
        <Drawer
          placement="top"
          open={open}
          height={Math.min(window.innerHeight * 0.6, 480)}
          closable={false}
          mask={true}
          onClose={() => setOpen(false)}
          bodyStyle={{ padding: 12 }}
          styles={{ header: { display: 'none' } }}
        >
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 16 }}>通知</Text>
            <Space size={4}>
              <Button size="small" icon={<ReloadOutlined />} onClick={refresh} loading={loading}>刷新</Button>
              <Button size="small" onClick={onMarkAll} icon={<CheckOutlined />} loading={markingAll}>全部已读</Button>
              <Button size="small" onClick={() => setOpen(false)}>关闭</Button>
            </Space>
          </div>
          {content}
        </Drawer>
      </>
    );
  }
  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={async (v) => { setOpen(v); if (v) await refresh(); }}
      placement="bottomRight"
      overlayInnerStyle={{ padding: 12 }}
      getPopupContainer={() => document.body}
      overlayStyle={{ zIndex: 2000 }}
      arrow={false}
    >
      <Badge count={unreadCount} size="small" offset={[ -2, 6 ]} overflowCount={99}>
        <Button shape="circle" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  );
}
