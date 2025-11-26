import React, { useState, useContext } from "react";
import { Form, Input, Button, Card, message, Divider } from "antd";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import AuthContext from "../contexts/AuthContext.jsx";
import GitHubLogin from "../components/GitHubLogin.jsx";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const intl = useIntl();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const ok = await login(values.username, values.password);
      if (ok) {
        message.success(intl.formatMessage({ id: 'login.success', defaultMessage: '登录成功' }));
        navigate('/user');
      } else {
        message.error(intl.formatMessage({ id: 'login.failed', defaultMessage: '登录失败' }));
      }
    } catch (e) {
      console.error(e);
      message.error(intl.formatMessage({ id: 'login.error', defaultMessage: '登录出错' }));
    } finally {
      setLoading(false);
    }
  };

  // 处理 GitHub 登录成功（回调页会直接写入 token，这里仅作为窗口模式的兜底）
  const handleGitHubSuccess = ({ access_token, refresh_token }) => {
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    message.success('GitHub 登录成功');
    navigate('/');
    window.location.reload();
  };

  return (
    <Card title={intl.formatMessage({ id: 'login.title', defaultMessage: '登录' })}>
      <Form name="login" layout="vertical" onFinish={onFinish}>
        <Form.Item name="username" label={intl.formatMessage({ id: 'login.username.label', defaultMessage: '用户名' })} rules={[{ required: true, message: intl.formatMessage({ id: 'login.username.required', defaultMessage: '请输入用户名' }) }]}>
          <Input placeholder={intl.formatMessage({ id: 'login.username.placeholder', defaultMessage: '用户名' })} />
        </Form.Item>
        <Form.Item name="password" label={intl.formatMessage({ id: 'login.password.label', defaultMessage: '密码' })} rules={[{ required: true, message: intl.formatMessage({ id: 'login.password.required', defaultMessage: '请输入密码' }) }]}>
          <Input.Password placeholder={intl.formatMessage({ id: 'login.password.placeholder', defaultMessage: '密码' })} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {intl.formatMessage({ id: 'login.button', defaultMessage: '登录' })}
          </Button>
        </Form.Item>
      </Form>

      <Divider>或</Divider>

      <GitHubLogin
        onSuccess={handleGitHubSuccess}
        buttonText="GitHub 登录"
        buttonProps={{
          type: 'default',
          style: {
            backgroundColor: '#24292e',
            color: 'white',
            borderColor: '#24292e'
          }
        }}
      />
    </Card>
  );
}
