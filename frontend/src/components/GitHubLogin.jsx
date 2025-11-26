import React from 'react';
import { Button, message } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import apiClient from '../api/apiClient';

export default function GitHubLogin({ onSuccess, buttonText = 'GitHub 登录', buttonProps = {} }) {
  const handleGitHubLogin = async () => {
    try {
      const resp = await apiClient.get('users/github/login-url/');
      const { login_url } = resp.data;
      if (!login_url) {
        message.error('获取 GitHub 登录地址失败');
        return;
      }
      // 直接跳转（使用整页跳转更兼容，若需要窗口模式可改成 window.open）
      window.location.href = login_url;
    } catch (e) {
      console.error(e);
      message.error('请求 GitHub 登录失败');
    }
  };

  return (
    <Button
      icon={<GithubOutlined />}
      onClick={handleGitHubLogin}
      block
      {...buttonProps}
    >
      {buttonText}
    </Button>
  );
}