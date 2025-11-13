import React, { useState, useContext, createContext } from "react";
import ReactDOM from "react-dom/client";
import { IntlProvider } from "react-intl";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Modal, ConfigProvider } from "antd";
import ModelList from "./pages/ModelList.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Compare from "./pages/Compare.jsx";
import Login from "./pages/Login.jsx";
import Forum from "./pages/Forum.jsx"; // 1. 导入新的 Forum 页面
import Chat from "./pages/Chat.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import AppLayout from "./components/AppLayout.jsx";
import { ModeProvider } from './contexts/ModeContext';
import { ChatProvider } from './contexts/ChatContext';

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

function App() {
  return (
    <ModeProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ModelList />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          {/* 2. 在 AppLayout 中添加新的路由 */}
          <Route path="/forum" element={<Forum />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </ModeProvider>
  );
}

const messages = {};
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#000000',
          colorInfo: '#000000',
          colorLink: '#000000',
          colorSuccess: '#595959',
        },
      }}
    >
      <IntlProvider locale="zh" messages={messages}>
        <AuthProvider>
          <DialogProvider>
            <Router>
              <ChatProvider>
                <App />
              </ChatProvider>
            </Router>
          </DialogProvider>
        </AuthProvider>
      </IntlProvider>
    </ConfigProvider>
  </React.StrictMode>
);