import React, { useEffect } from 'react';
import { Spin, message } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const access_token = searchParams.get('access_token');
    const refresh_token = searchParams.get('refresh_token');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // 情况 1：后端已重定向携带 access_token / refresh_token
    if (access_token && refresh_token) {
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      message.success('GitHub 登录成功');
      navigate('/');
      window.location.reload();
      return;
    }

    // 情况 2：GITHUB_REDIRECT_URI 指向前端，当前仅有 code/state，需要调用后端交换
    if (code) {
      (async () => {
        try {
          const resp = await apiClient.get(`users/github/exchange/?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
          const data = resp.data;
          if (data.access_token && data.refresh_token) {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            message.success('GitHub 登录成功');
            navigate('/');
            window.location.reload();
          } else {
            message.error('GitHub 登录失败：后端未返回令牌');
            navigate('/login');
          }
        } catch (e) {
          console.error(e);
          message.error('GitHub 登录失败：交换令牌出错');
          navigate('/login');
        }
      })();
      return;
    }

    // 情况 3：参数不完整
    message.error('GitHub 登录失败：缺少必要参数');
    navigate('/login');
  }, [searchParams, navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" tip="正在处理 GitHub 登录..." />
    </div>
  );
}