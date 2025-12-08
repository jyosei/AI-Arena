import React, { useState, useContext, createContext } from "react";
import 'katex/dist/katex.min.css';
import ReactDOM from "react-dom/client";
import { IntlProvider } from "react-intl";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Modal, ConfigProvider } from "antd";

// 1. 导入所有页面和组件
import ModelList from "./pages/ModelList.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Login from "./pages/Login.jsx";
import Forum from "./pages/Forum.jsx";
import ForumPost from "./pages/ForumPost.jsx"; // 新增导入
import Chat from "./pages/Chat.jsx";
import AppLayout from "./components/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import UserCenter from "./pages/UserCenter.jsx";
import DatasetEvaluationPage from "./pages/DatasetEvaluation.jsx";
import BenchmarkLeaderboard from './pages/BenchmarkLeaderboard';
// 2. 导入所有需要的 Context Provider
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ModeProvider } from './contexts/ModeContext';
import { ChatProvider } from './contexts/ChatContext';

// 3. 定义 Dialog Context (如果它只在这里使用)
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

  const showDialog = (config) => setDialogConfig({ ...dialogConfig, ...config, open: true });
  const hideDialog = () => setDialogConfig({ ...dialogConfig, open: false });

  const value = { showDialog, hideDialog };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal {...dialogConfig} onOk={dialogConfig.onOk} onCancel={dialogConfig.onCancel || hideDialog} />
    </DialogContext.Provider>
  );
};

export const useDialog = () => useContext(DialogContext);


// 4. 定义应用的根组件，它包含了所有路由和布局
function App() {
  return (
    <Router>
      <AuthProvider>
        <ModeProvider>
          <ChatProvider>
            <DialogProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<ModelList />} />
                  <Route path="/chat/:id" element={<Chat />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/forum" element={<Forum />} />
                  <Route path="/forum/post/:id" element={<ForumPost />} /> {/* 新增路由 */}
                  <Route
                    path="/user-center"
                    element={(
                      <ProtectedRoute>
                        <UserCenter />
                      </ProtectedRoute>
                    )}
                  />
                  <Route path="/evaluate-dataset" element={<DatasetEvaluationPage />} />
                  <Route path="benchmark-leaderboard" element={<BenchmarkLeaderboard />} /> 
                </Route>
                <Route path="/login" element={<Login />} />
              </Routes>
            </DialogProvider>
          </ChatProvider>
        </ModeProvider>
      </AuthProvider>
    </Router>
  );
}

// 5. 渲染应用
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
      <IntlProvider locale="zh" messages={{}}>
        <App />
      </IntlProvider>
    </ConfigProvider>
  </React.StrictMode>
);