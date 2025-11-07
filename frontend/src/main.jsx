import React, { useState, useContext, createContext } from "react";
import ReactDOM from "react-dom/client";
import { IntlProvider } from "react-intl";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Modal } from "antd";
import ModelList from "./pages/ModelList.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Compare from "./pages/Compare.jsx";
import Login from "./pages/Login.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import AppLayout from "./components/AppLayout.jsx";

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
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ModelList />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Route>
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}

const messages = {};
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <IntlProvider locale="zh" messages={messages}>
      <AuthProvider>
        <DialogProvider>
          <Router>
            <App />
          </Router>
        </DialogProvider>
      </AuthProvider>
    </IntlProvider>
  </React.StrictMode>
);