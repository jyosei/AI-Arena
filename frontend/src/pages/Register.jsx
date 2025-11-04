import React, { useState, useContext } from 'react';
import { Card, Input, Button, message } from 'antd';
import AuthContext from '../contexts/AuthContext.jsx';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '' });
  const { register } = useContext(AuthContext);

  const handle = async () => {
    try {
      await register({ username: form.username, password: form.password });
      message.success('注册成功，请登录');
    } catch (e) {
      message.error('注册失败');
    }
  };

  return (
    <Card title="注册">
      <Input placeholder="用户名" onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <Input.Password placeholder="密码" style={{ marginTop: 8 }} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <Button type="primary" style={{ marginTop: 12 }} onClick={handle}>注册</Button>
    </Card>
  );
}
