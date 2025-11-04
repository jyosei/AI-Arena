import React, { useState, useContext, createContext } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Layout, Menu, Modal } from "antd";
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

const DialogContext = createContext();

export const DialogProvider = ({ children }) => {
  const [dialogConfig, setDialogConfig] = useState({
    open: false,
    title: "",
    content: null,
    onOk: null,
    onCancel: null,
    okText: "确定",
    cancelText: "取消",
    width: 520,
    closable: true,
    maskClosable: true,
  });

  const showDialog = (config) => {
    setDialogConfig({
      ...dialogConfig,
      ...config,
      open: true,
    });
  };

  const hideDialog = () => {
    setDialogConfig({
      ...dialogConfig,
      open: false,
    });
  };

  const handleOk = () => {
    if (dialogConfig.onOk) {
      dialogConfig.onOk();
    }
    hideDialog();
  };

  const handleCancel = () => {
    if (dialogConfig.onCancel) {
      dialogConfig.onCancel();
    }
    hideDialog();
  };

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}
      <Modal
        title={dialogConfig.title}
        open={dialogConfig.open}
        onOk={handleOk}
        onCancel={handleCancel}
        okText={dialogConfig.okText}
        cancelText={dialogConfig.cancelText}
        width={dialogConfig.width}
        closable={dialogConfig.closable}
        maskClosable={dialogConfig.maskClosable}
      >
        {dialogConfig.content}
      </Modal>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};

const App = () => (
  <AuthProvider>
    <DialogProvider>
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
              <Menu.Item key="register"><Link to="/register">注册</Link></Menu.Item>
              <Menu.Item key="home"><Link to="/">首页</Link></Menu.Item>
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
    </DialogProvider>
  </AuthProvider>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);