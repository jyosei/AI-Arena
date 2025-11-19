import React, { useContext, useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Typography, Popconfirm } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import AuthContext from '../contexts/AuthContext.jsx';
import { updateProfile, changePassword } from '../api/users.js';

const { Dragger } = Upload;

export default function UserCenter() {
  const { user, refreshProfile, logout } = useContext(AuthContext);
  const [profileForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ username: user.username, description: user.description || '', avatar: user.avatar || '' });
    }
  }, [user]);

  const handleProfileSubmit = async (values) => {
    setSavingProfile(true);
    try {
      const payload = { ...values };
      const fileObj = Array.isArray(values.avatar_file) && values.avatar_file.length > 0
        ? values.avatar_file[0].originFileObj
        : null;
      if (fileObj) {
        payload.avatar_file = fileObj;
      }
      await updateProfile(payload);
      message.success('资料已更新');
      await refreshProfile();
    } catch (e) {
      message.error(e.response?.data?.detail || '更新失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (values) => {
    setChangingPwd(true);
    try {
      await changePassword(values.current_password, values.new_password);
      message.success('密码修改成功，请重新登录');
    } catch (e) {
      message.error(e.response?.data?.detail || '修改失败');
    } finally {
      setChangingPwd(false);
      pwdForm.resetFields();
    }
  };

  // 通知功能已迁出到顶部铃铛组件，此页不再包含通知模块

  if (!user) {
    return <Card>请先登录后再访问用户中心。</Card>;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="编辑资料" bordered>
        <Form layout="vertical" form={profileForm} onFinish={handleProfileSubmit}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少3个字符' }]}>
            <Input maxLength={32} />
          </Form.Item>
          <Form.Item label="简介" name="description">
            <Input.TextArea rows={3} maxLength={300} showCount />
          </Form.Item>
          <Form.Item label="外部头像URL" name="avatar" tooltip="如果填写将使用外链头像，上传文件将覆盖此设置">
            <Input placeholder="https://example.com/avatar.png" />
          </Form.Item>
          <Form.Item
            label="上传新头像"
            name="avatar_file"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) return e;
              return e && e.fileList ? e.fileList.slice(-1) : [];
            }}
          >
            <Dragger
              multiple={false}
              maxCount={1}
              beforeUpload={() => false}
              accept="image/png,image/jpeg,image/jpg,image/webp"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽图片到此处上传</p>
              <p className="ant-upload-hint">仅支持常见图片格式，大小建议 &lt; 2MB</p>
            </Dragger>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={savingProfile}>保存资料</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="修改密码" bordered>
        <Form layout="vertical" form={pwdForm} onFinish={handlePasswordSubmit}>
          <Form.Item label="当前密码" name="current_password" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="新密码" name="new_password" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少6个字符' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="确认新密码" name="confirm" dependencies={["new_password"]} rules={[{ required: true, message: '请确认新密码' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('new_password') === value) { return Promise.resolve(); } return Promise.reject(new Error('两次输入不一致')); } })]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={changingPwd}>修改密码</Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 通知列表已移动到顶部铃铛 NotificationBell 中 */}
      <Card bordered>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">安全操作</Typography.Text>
          <Popconfirm title="确认退出登录？" okText="确认" cancelText="取消" onConfirm={() => { logout(); message.success('已退出'); }}>
            <Button danger>退出登录</Button>
          </Popconfirm>
        </Space>
      </Card>
    </Space>
  );
}
