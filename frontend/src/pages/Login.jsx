import React, { useState, useContext } from "react";
import { Form, Input, Button, Card, message } from "antd";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import AuthContext from "../contexts/AuthContext.jsx";

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
          <Button type="primary" htmlType="submit" block loading={loading}>{intl.formatMessage({ id: 'login.button', defaultMessage: '登录' })}</Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
