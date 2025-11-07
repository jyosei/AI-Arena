import React, { createContext, useState, useContext, useEffect } from 'react';
import { getModels } from '../api/models'; // 导入 API

const ModeContext = createContext(null);

export const ModeProvider = ({ children }) => {
  // 模式状态
  const [mode, setMode] = useState('battle');
  
  // 模型列表和选择状态
  const [models, setModels] = useState([]);
  const [leftModel, setLeftModel] = useState(null);
  const [rightModel, setRightModel] = useState(null);

  // 在 Provider 加载时获取模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await getModels();
        setModels(res.data || []);
      } catch (error) {
        console.error("Failed to fetch models in context:", error);
      }
    };
    fetchModels();
  }, []);

  // 将所有需要共享的状态和函数放入 value
  const value = { 
    mode, setMode,
    models,
    leftModel, setLeftModel,
    rightModel, setRightModel
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode 必须在 ModeProvider 内部使用');
  }
  return context;
};