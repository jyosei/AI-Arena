import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Drawer, Input, Spin, Typography, message } from 'antd';
import { SendOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import AuthContext from '../contexts/AuthContext.jsx';
import { getPrivateChatMessages, sendPrivateChatMessage } from '../api/users.js';
import { resolveMediaUrl } from '../utils/media.js';
import { formatDateTime } from '../utils/time.js';

const { TextArea } = Input;

export default function PrivateChatDrawer({ open, targetUser, onClose, onMessageSent }) {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const targetTitle = useMemo(() => {
    if (!targetUser) return '好友私聊';
    return `与 ${targetUser.username} 的私聊`;
  }, [targetUser]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!open || !targetUser?.id) {
      return;
    }
    setLoading(true);
    try {
      const res = await getPrivateChatMessages(targetUser.id);
      const data = res.data || {};
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || '加载私聊失败';
      message.error(detail);
      if (error?.response?.status === 403) {
        onClose?.();
      }
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    }
  }, [open, targetUser?.id, onClose, scrollToBottom]);

  useEffect(() => {
    if (open && targetUser?.id) {
      loadMessages();
    } else {
      setMessages([]);
      setInputValue('');
    }
  }, [open, targetUser?.id, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content) {
      message.warning('请输入要发送的内容');
      return;
    }
    if (!targetUser?.id) {
      return;
    }
    setSending(true);
    try {
      const res = await sendPrivateChatMessage(targetUser.id, content);
      const payload = res.data;
      setMessages((prev) => [...prev, payload]);
      setInputValue('');
      if (onMessageSent) {
        onMessageSent(payload);
      }
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || '发送失败';
      message.error(detail);
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 50);
    }
  }, [inputValue, targetUser?.id, onMessageSent, scrollToBottom]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <Drawer
      title={targetTitle}
      width={420}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
      rootClassName="aa-chat-drawer"
      bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column' }}
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={loadMessages} disabled={loading} className="aa-ghost-btn">
          刷新
        </Button>
      }
    >
      <div className="aa-chat-shell">
        <Spin spinning={loading} className="aa-chat-spinner">
          <div className="aa-chat-messages">
            {messages.map((item, index) => {
              const isMe = user && item.sender?.id === user.id;
              const avatar = resolveMediaUrl(item.sender?.avatar_url || item.sender?.avatar);
              const key = item.id || `${item.created_at}-${index}`;
              return (
                <div key={key} className={`aa-chat-row ${isMe ? 'is-me' : 'is-peer'}`}>
                  {!isMe ? (
                    <Avatar src={avatar} icon={<UserOutlined />} size={36} className="aa-chat-avatar" />
                  ) : null}
                  <div className={`aa-chat-bubble ${isMe ? 'me' : 'peer'}`}>
                    <Typography.Paragraph className="aa-chat-text">
                      {item.content}
                    </Typography.Paragraph>
                    <Typography.Text className="aa-chat-time">
                      {formatDateTime(item.created_at)}
                    </Typography.Text>
                  </div>
                  {isMe ? (
                    <Avatar src={resolveMediaUrl(user?.avatar_url || user?.avatar)} icon={<UserOutlined />} size={36} className="aa-chat-avatar" />
                  ) : null}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </Spin>
        <div className="aa-chat-input-area">
          <TextArea
            rows={3}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
            className="aa-chat-input"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            block
            className="aa-chat-send-btn"
          >
            发送
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
