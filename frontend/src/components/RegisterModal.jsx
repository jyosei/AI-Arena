import React, { useState, useContext } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { useIntl } from 'react-intl';
import AuthContext from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function RegisterModal({ visible, onClose }) {
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);
  const intl = useIntl();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await register({ username: values.username, password: values.password });
      if (result && result.success) {
        if (result.autoLogin) {
          message.success(intl.formatMessage({ id: 'register.success', defaultMessage: '注册并已自动登录' }));
          onClose();
          navigate('/user');
        } else {
          message.success(intl.formatMessage({ id: 'register.success', defaultMessage: '注册成功，请登录' }));
          onClose();
          navigate('/login');
        }
      } else {
        message.success(intl.formatMessage({ id: 'register.success', defaultMessage: '注册成功，请登录' }));
        onClose();
        navigate('/login');
      }
    } catch (e) {
      console.error(e);
      message.error(intl.formatMessage({ id: 'register.failed', defaultMessage: '注册失败' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={intl.formatMessage({ id: 'register.title', defaultMessage: '注册' })}
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form name="register" layout="vertical" onFinish={onFinish}>
        <Form.Item name="username" label={intl.formatMessage({ id: 'register.username.label', defaultMessage: '用户名' })} rules={[{ required: true, message: intl.formatMessage({ id: 'register.username.required', defaultMessage: '请输入用户名' }) }]}> 
          <Input placeholder={intl.formatMessage({ id: 'register.username.placeholder', defaultMessage: '用户名' })} />
        </Form.Item>
        <Form.Item name="password" label={intl.formatMessage({ id: 'register.password.label', defaultMessage: '密码' })} rules={[{ required: true, message: intl.formatMessage({ id: 'register.password.required', defaultMessage: '请输入密码' }) }]} hasFeedback>
          <Input.Password placeholder={intl.formatMessage({ id: 'register.password.placeholder', defaultMessage: '密码' })} />
        </Form.Item>
        <Form.Item name="confirm" label={intl.formatMessage({ id: 'register.confirm.label', defaultMessage: '确认密码' })} dependencies={["password"]} hasFeedback rules={[{ required: true, message: intl.formatMessage({ id: 'register.confirm.required', defaultMessage: '请确认密码' }) }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) { return Promise.resolve(); } return Promise.reject(new Error(intl.formatMessage({ id: 'register.confirm.mismatch', defaultMessage: '两次输入的密码不一致' }))); }, }), ]}>
          <Input.Password placeholder={intl.formatMessage({ id: 'register.confirm.placeholder', defaultMessage: '确认密码' })} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {intl.formatMessage({ id: 'register.button', defaultMessage: '注册' })}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
