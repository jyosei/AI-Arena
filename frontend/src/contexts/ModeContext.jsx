import React, { createContext, useState, useContext } from 'react';

// 1. 创建 Context
const ModeContext = createContext(null);

// 2. 创建 Provider 组件
export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState('battle'); // 将 mode 状态移到这里

  const value = { mode, setMode };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

// 3. 创建一个自定义 Hook，方便使用
export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode 必须在 ModeProvider 内部使用');
  }
  return context;
};