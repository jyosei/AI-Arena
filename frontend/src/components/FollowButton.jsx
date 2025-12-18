import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button, message, Tooltip } from 'antd';
import { UserAddOutlined, CheckOutlined, SwapOutlined } from '@ant-design/icons';
import AuthContext from '../contexts/AuthContext.jsx';
import { followUser, getFollowStatus, unfollowUser } from '../api/users.js';

const reasonMap = {
  INITIAL: 'initial',
  UPDATE: 'update',
  UNAUTH: 'unauthenticated',
  ERROR: 'error',
};

export default function FollowButton({
  targetUserId,
  size = 'middle',
  disabled = false,
  onStatusChange,
  buttonProps = {},
  initialStatus = null,
}) {
  const { user } = useContext(AuthContext);
  const [status, setStatus] = useState(initialStatus || null);
  const [loading, setLoading] = useState(false);
  const statusChangeHandlerRef = useRef(onStatusChange);
  const customButtonClass = buttonProps?.className;
  const { className: _classNameIgnored, ...restButtonProps } = buttonProps;

  useEffect(() => {
    statusChangeHandlerRef.current = onStatusChange;
  }, [onStatusChange]);

  const notifyStatus = useCallback((nextStatus, reason) => {
    setStatus(nextStatus);
    const handler = statusChangeHandlerRef.current;
    if (handler) {
      handler(nextStatus, { reason });
    }
  }, []);

  const fetchStatus = useCallback(async (reason = reasonMap.INITIAL) => {
    if (!targetUserId || !user || user.id === targetUserId) {
      notifyStatus(null, user ? reasonMap.UNAUTH : reasonMap.UNAUTH);
      return;
    }
    setLoading(true);
    try {
      const res = await getFollowStatus(targetUserId);
      notifyStatus(res.data, reason);
    } catch (error) {
      if (error?.response?.status === 404) {
        notifyStatus(null, reasonMap.ERROR);
      } else if (error?.response?.status === 401) {
        notifyStatus(null, reasonMap.UNAUTH);
      } else {
        message.error('获取关注状态失败');
        notifyStatus(null, reasonMap.ERROR);
      }
    } finally {
      setLoading(false);
    }
  }, [targetUserId, user, notifyStatus]);

  useEffect(() => {
    if (!targetUserId) {
      notifyStatus(null, reasonMap.ERROR);
      return;
    }
    if (!user) {
      notifyStatus(null, reasonMap.UNAUTH);
      return;
    }
    if (user.id === targetUserId) {
      notifyStatus(null, reasonMap.UNAUTH);
      return;
    }
    if (initialStatus) {
      notifyStatus(initialStatus, reasonMap.INITIAL);
      return;
    }
    fetchStatus(reasonMap.INITIAL);
  }, [targetUserId, user, initialStatus, fetchStatus, notifyStatus]);

  const handleToggle = useCallback(async () => {
    if (!user) {
      message.info('请先登录后再关注');
      return;
    }
    if (!targetUserId || user.id === targetUserId) {
      return;
    }
    setLoading(true);
    try {
      if (status?.following) {
        await unfollowUser(targetUserId);
        message.success('已取消关注');
      } else {
        await followUser(targetUserId);
        message.success('关注成功');
      }
      await fetchStatus(reasonMap.UPDATE);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || '操作失败，请稍后重试';
      message.error(detail);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId, status?.following, fetchStatus]);

  const buttonLabel = useMemo(() => {
    if (!status || !status.following) {
      if (status?.followed_by_target) {
        return '回关';
      }
      return '关注';
    }
    if (status.mutual) {
      return '互相关注';
    }
    return '已关注';
  }, [status]);

  const buttonType = useMemo(() => {
    if (!status || !status.following) {
      return 'primary';
    }
    return 'default';
  }, [status]);

  const icon = useMemo(() => {
    if (!status || !status.following) {
      return <UserAddOutlined />;
    }
    if (status.mutual) {
      return <SwapOutlined />;
    }
    return <CheckOutlined />;
  }, [status]);

  const mergedButtonClassName = useMemo(() => (
    customButtonClass ? `aa-follow-btn ${customButtonClass}` : 'aa-follow-btn'
  ), [customButtonClass]);

  if (!targetUserId || (user && user.id === targetUserId)) {
    return null;
  }

  return (
    <Tooltip title={!user ? '登录后可关注其他用户' : undefined}>
      <Button
        size={size}
        type={buttonType}
        icon={icon}
        loading={loading}
        onClick={handleToggle}
        disabled={disabled || loading}
        className={mergedButtonClassName}
        {...restButtonProps}
      >
        {buttonLabel}
      </Button>
    </Tooltip>
  );
}
