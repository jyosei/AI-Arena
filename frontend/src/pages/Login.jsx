import React, { useState } from "react";
import { Input, Button, Card, message } from "antd";
import request from "../api/request";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const handleLogin = async () => {
    const res = await request.post("token/", form);
    if (res.data.access) {
      localStorage.setItem("token", res.data.access);
      message.success("登录成功");
    }
  };
  return (
    <Card title="AI Arena 登录">
      <Input
        placeholder="用户名"
        onChange={(e) => setForm({ ...form, username: e.target.value })}
      />
      <Input.Password
        placeholder="密码"
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <Button onClick={handleLogin}>登录</Button>
    </Card>
  );
}
