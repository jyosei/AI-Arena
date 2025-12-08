import React, { useState, useContext, createContext } from "react";
import 'katex/dist/katex.min.css';
import './global.css';
import ReactDOM from "react-dom/client";
import { IntlProvider } from "react-intl";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Modal, ConfigProvider } from "antd";

// 页面和组件
import ModelList from "./pages/ModelList.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import UserPanel from "./pages/UserPanel.jsx";
import Forum from "./pages/Forum.jsx";
import ForumPost from "./pages/ForumPost.jsx";
import Chat from "./pages/Chat.jsx";
import AppLayout from "./components/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import UserCenter from "./pages/UserCenter.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import GitHubCallback from "./pages/GitHubCallback.jsx"; // GitHub 登录回调页面

import DatasetEvaluationPage from "./pages/DatasetEvaluation.jsx";
import BenchmarkLeaderboard from './pages/BenchmarkLeaderboard';
import DatasetEvaluationHistoryPage from "./pages/DatasetEvaluationHistory.jsx";
// 2. 导入所有需要的 Context Provider
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ModeProvider } from './contexts/ModeContext';
import { ChatProvider } from './contexts/ChatContext';

// Dialog Context
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

// App 根组件
function App() {
  return (
    <Router>
      <AuthProvider>
        <ModeProvider>
          <ChatProvider>
            <DialogProvider>
              <Routes>
                {/* GitHub 登录回调路由 - 不需要 AppLayout */}
                <Route path="/login/github/callback" element={<GitHubCallback />} />
                
                <Route element={<AppLayout />}>
                  <Route path="/" element={<ModelList />} />
                  <Route path="/chat/:id" element={<Chat />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/forum" element={<Forum />} />
                  <Route path="/forum/post/:id" element={<ForumPost />} />

                  {/* 保留 HEAD 的用户中心 */}
                  <Route
                    path="/user-center"
                    element={
                      <ProtectedRoute>
                        <UserCenter />
                      </ProtectedRoute>
                    }
                  />

                  {/* 保留 shallcheer 的用户面板 */}
                  <Route path="/user" element={<UserPanel />} />
                  <Route path="/evaluate-dataset" element={<DatasetEvaluationPage />} />
                  <Route path="benchmark-leaderboard" element={<BenchmarkLeaderboard />} /> 
                  <Route path="/evaluate-dataset/history" element={<DatasetEvaluationHistoryPage />} />
                </Route>
              </Routes>
            </DialogProvider>
          </ChatProvider>
        </ModeProvider>
      </AuthProvider>
    </Router>
  );
}

// 渲染
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
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
    </ErrorBoundary>
  </React.StrictMode>
);
