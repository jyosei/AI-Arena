import React, { useState, useContext } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useIntl } from 'react-intl';
import AuthContext from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function RegisterModal({ visible, onClose, onShowLogin }) {
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);
  const intl = useIntl();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await register({ username: values.username, password: values.password });
      if (result && result.success) {
        message.success(intl.formatMessage({ id: 'register.success', defaultMessage: '注册成功，请登录' }));
        onClose();
        onShowLogin();
      } else {
        // 如果有具体的错误信息，显示它
        const errorMessage = result.errors?.username || result.errors?.password || result.errors?.non_field_errors || '注册失败';
        message.error(errorMessage);
        console.error('Registration failed:', result.errors);
      }
    } catch (e) {
      console.error('Registration error:', e.response?.data || e);
      const errorMessage = e.response?.data?.username || e.response?.data?.password || e.response?.data?.non_field_errors || '注册失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<div style={{ textAlign: 'center', fontWeight: 600, fontSize: 20 }}><UserOutlined style={{ color: '#000', marginRight: 8 }} />注册</div>}
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      centered
      bodyStyle={{ padding: '32px 32px 16px 32px', borderRadius: 16 }}
    >
      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <Form name="register" layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label={intl.formatMessage({ id: 'register.username.label', defaultMessage: '用户名' })} rules={[{ required: true, message: intl.formatMessage({ id: 'register.username.required', defaultMessage: '请输入用户名' }) }]}> 
            <Input placeholder={intl.formatMessage({ id: 'register.username.placeholder', defaultMessage: '用户名' })} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Form.Item name="password" label={intl.formatMessage({ id: 'register.password.label', defaultMessage: '密码' })} rules={[{ required: true, message: intl.formatMessage({ id: 'register.password.required', defaultMessage: '请输入密码' }) }]} hasFeedback>
            <Input.Password placeholder={intl.formatMessage({ id: 'register.password.placeholder', defaultMessage: '密码' })} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Form.Item name="confirm" label={intl.formatMessage({ id: 'register.confirm.label', defaultMessage: '确认密码' })} dependencies={["password"]} hasFeedback rules={[{ required: true, message: intl.formatMessage({ id: 'register.confirm.required', defaultMessage: '请确认密码' }) }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) { return Promise.resolve(); } return Promise.reject(new Error(intl.formatMessage({ id: 'register.confirm.mismatch', defaultMessage: '两次输入的密码不一致' }))); }, }), ]}>
            <Input.Password placeholder={intl.formatMessage({ id: 'register.confirm.placeholder', defaultMessage: '确认密码' })} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} style={{ borderRadius: 20, fontWeight: 500, minHeight: 40 }}>
              {intl.formatMessage({ id: 'register.button', defaultMessage: '注册' })}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}
