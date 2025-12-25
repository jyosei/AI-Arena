import React, { useContext, useState } from 'react';
import { Card, Button, Tabs, Form, Input, message } from 'antd';
import { useIntl } from 'react-intl';
import AuthContext from '../contexts/AuthContext.jsx';

const { TabPane } = Tabs;

export default function UserPanel() {
  const { user, logout, login, register } = useContext(AuthContext);
  const intl = useIntl();
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const usernameHints = [
    intl.formatMessage({ id: 'register.username.rule.length', defaultMessage: '长度至少3个字符' }),
    intl.formatMessage({ id: 'register.username.rule.start', defaultMessage: '必须以字母开头' }),
  ];
  const passwordHints = [
    intl.formatMessage({ id: 'register.password.rule.length', defaultMessage: '长度至少6个字符' }),
    intl.formatMessage({ id: 'register.password.rule.mix', defaultMessage: '包含数字、大写字母、小写字母、下划线中的至少两种' }),
  ];

  const onLogin = async (values) => {
    setLoadingLogin(true);
    try {
      const ok = await login(values.username, values.password);
      if (ok) {
        message.success(intl.formatMessage({ id: 'login.success', defaultMessage: '登录成功' }));
      } else {
        message.error(intl.formatMessage({ id: 'login.failed', defaultMessage: '登录失败' }));
      }
    } catch (e) {
      console.error(e);
      message.error(e.message || intl.formatMessage({ id: 'login.error', defaultMessage: '登录出错' }));
    } finally {
      setLoadingLogin(false);
    }
  };

  const onRegister = async (values) => {
    setLoadingRegister(true);
    try {
      const result = await register({ username: values.username, password: values.password });
      if (result && result.success) {
        if (result.autoLogin) {
          message.success(intl.formatMessage({ id: 'register.success', defaultMessage: '注册并已自动登录' }));
        } else {
          const loginErrMsg = result.loginError || intl.formatMessage({ id: 'register.success.login.manual', defaultMessage: '注册成功，但自动登录失败，请手动登录' });
          message.success(intl.formatMessage({ id: 'register.success', defaultMessage: '注册成功' }));
          message.warning(loginErrMsg);
          setActiveTab('login');
        }
      } else {
        // 注册失败：尝试显示后端返回的错误信息
        const errors = result?.errors;
        let errMsg = intl.formatMessage({ id: 'register.failed', defaultMessage: '注册失败' });
        if (errors) {
          if (errors.username) {
            errMsg = Array.isArray(errors.username) ? errors.username[0] : errors.username;
          } else if (errors.password) {
            errMsg = Array.isArray(errors.password) ? errors.password[0] : errors.password;
          } else if (errors.non_field_errors) {
            errMsg = Array.isArray(errors.non_field_errors) ? errors.non_field_errors[0] : errors.non_field_errors;
          } else if (errors.message) {
            errMsg = errors.message;
          }
        }
        message.error(errMsg);
      }
    } catch (e) {
      console.error(e);
      message.error(intl.formatMessage({ id: 'register.failed', defaultMessage: '注册失败' }));
    } finally {
      setLoadingRegister(false);
    }
  };

  if (!user) {
    return (
      <Card title={intl.formatMessage({ id: 'user.center.title', defaultMessage: '用户中心' })} style={{ maxWidth: 720, margin: '0 auto' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} centered>
          <TabPane tab={intl.formatMessage({ id: 'login.tab', defaultMessage: '登录' })} key="login">
            <Form name="login" layout="vertical" onFinish={onLogin}>
              <Form.Item name="username" label={intl.formatMessage({ id: 'login.username.label', defaultMessage: '用户名' })} rules={[{ required: true, message: intl.formatMessage({ id: 'login.username.required', defaultMessage: '请输入用户名' }) }]}>
                <Input placeholder={intl.formatMessage({ id: 'login.username.placeholder', defaultMessage: '用户名' })} />
              </Form.Item>
              <Form.Item name="password" label={intl.formatMessage({ id: 'login.password.label', defaultMessage: '密码' })} rules={[{ required: true, message: intl.formatMessage({ id: 'login.password.required', defaultMessage: '请输入密码' }) }]}>
                <Input.Password placeholder={intl.formatMessage({ id: 'login.password.placeholder', defaultMessage: '密码' })} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loadingLogin}>{intl.formatMessage({ id: 'login.button', defaultMessage: '登录' })}</Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab={intl.formatMessage({ id: 'register.tab', defaultMessage: '注册' })} key="register">
            <Form name="register" layout="vertical" onFinish={onRegister}>
              <Form.Item
                name="username"
                label={intl.formatMessage({ id: 'register.username.label', defaultMessage: '用户名' })}
                rules={[{ required: true, message: intl.formatMessage({ id: 'register.username.required', defaultMessage: '请输入用户名' }) }]}
                extra={(
                  <div className="form-hint">
                    <div>{intl.formatMessage({ id: 'register.username.hint.title', defaultMessage: '用户名要求：' })}</div>
                    <ul>
                      {usernameHints.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              >
                <Input placeholder={intl.formatMessage({ id: 'register.username.placeholder', defaultMessage: '用户名' })} />
              </Form.Item>
              <Form.Item
                name="password"
                label={intl.formatMessage({ id: 'register.password.label', defaultMessage: '密码' })}
                rules={[{ required: true, message: intl.formatMessage({ id: 'register.password.required', defaultMessage: '请输入密码' }) }]}
                hasFeedback
                extra={(
                  <div className="form-hint">
                    <div>{intl.formatMessage({ id: 'register.password.hint.title', defaultMessage: '密码要求：' })}</div>
                    <ul>
                      {passwordHints.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              >
                <Input.Password placeholder={intl.formatMessage({ id: 'register.password.placeholder', defaultMessage: '密码' })} />
              </Form.Item>
              <Form.Item name="confirm" label={intl.formatMessage({ id: 'register.confirm.label', defaultMessage: '确认密码' })} dependencies={["password"]} hasFeedback rules={[{ required: true, message: intl.formatMessage({ id: 'register.confirm.required', defaultMessage: '请确认密码' }) }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) { return Promise.resolve(); } return Promise.reject(new Error(intl.formatMessage({ id: 'register.confirm.mismatch', defaultMessage: '两次输入的密码不一致' }))); }, }), ]}>
                <Input.Password placeholder={intl.formatMessage({ id: 'register.confirm.placeholder', defaultMessage: '确认密码' })} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loadingRegister}>{intl.formatMessage({ id: 'register.button', defaultMessage: '注册' })}</Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    );
  }

  return (
    <Card title={intl.formatMessage({ id: 'user.center.title', defaultMessage: '用户中心' })} style={{ maxWidth: 720, margin: '0 auto' }}>
      <p><strong>{intl.formatMessage({ id: 'user.field.username', defaultMessage: '用户名' })}:</strong> {user.username}</p>
      <p><strong>{intl.formatMessage({ id: 'user.field.email', defaultMessage: '邮箱' })}:</strong> {user.email || '-'}</p>
      <p><strong>{intl.formatMessage({ id: 'user.field.role', defaultMessage: '权限' })}:</strong> {user.is_staff ? intl.formatMessage({ id: 'user.role.admin', defaultMessage: '管理员' }) : intl.formatMessage({ id: 'user.role.user', defaultMessage: '普通用户' })}</p>
      <Button danger onClick={logout}>{intl.formatMessage({ id: 'user.logout', defaultMessage: '登出' })}</Button>
    </Card>
  );
}
