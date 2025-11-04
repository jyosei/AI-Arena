import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Layout, Menu } from "antd";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ModelList from "./pages/ModelList.jsx";
import ModelDetail from "./pages/ModelDetail.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Compare from "./pages/Compare.jsx";
import UserPanel from "./pages/UserPanel.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const { Header, Content } = Layout;

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Header>
          <div style={{ float: 'left', color: '#fff', marginRight: 20 }}>AI Arena</div>
          <Menu theme="dark" mode="horizontal" selectable={false}>
            <Menu.Item key="models"><Link to="/models">模型库</Link></Menu.Item>
            <Menu.Item key="leaderboard"><Link to="/leaderboard">排行榜</Link></Menu.Item>
            <Menu.Item key="compare"><Link to="/compare">模型对比</Link></Menu.Item>
            <Menu.Item key="user"><Link to="/user">用户面板</Link></Menu.Item>
            <Menu.Item key="login"><Link to="/login">登录</Link></Menu.Item>
          </Menu>
        </Header>
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<ModelList />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/models" element={<ModelList />} />
            <Route path="/models/:id" element={<ModelDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/user" element={<ProtectedRoute><UserPanel /></ProtectedRoute>} />
          </Routes>
        </Content>
      </Layout>
    </BrowserRouter>
  </AuthProvider>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
