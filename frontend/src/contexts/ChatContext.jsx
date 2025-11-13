import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';
import request from '../api/request';
import AuthContext from './AuthContext.jsx';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // 根据是否有登录用户，从后端或本地存储加载聊天记录
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const loadLocal = () => {
      const savedHistory = localStorage.getItem('chatHistory');
      if (savedHistory) {
        try {
          setChatHistory(JSON.parse(savedHistory));
        } catch (error) {
          console.error('Failed to load chat history:', error);
        }
      } else {
        setChatHistory([]);
      }
    };

    if (user) {
      // 登录用户：尝试从后端获取用户专属历史
      console.log('User logged in, fetching chat history from backend...');
      request.get('models/chat/history/')
        .then(res => {
          console.log('Backend chat history:', res.data);
          // 将后端数据适配为前端历史记录项格式（id/title/model_name/time）
          const adapted = res.data.map(item => ({ 
            id: item.id, 
            title: item.title, 
            model_name: item.model_name,
            time: item.created_at 
          }));
          setChatHistory(adapted);
          // 同步到 localStorage 以便离线查看
          saveToLocalStorage(adapted);
        })
        .catch(err => {
          console.error('Failed to fetch chat history from backend, fallback to local:', err);
          loadLocal();
        });
    } else {
      // 未登录用户：清空状态，使用本地存储
      console.log('User logged out, loading from localStorage...');
      setChatHistory([]);
      loadLocal();
    }
  }, [user]);

  // 保存聊天记录到本地存储
  const saveToLocalStorage = (history) => {
    try {
      localStorage.setItem('chatHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  // 添加新的聊天记录
  const addChat = async (title, modelName) => {
    // 如果用户已登录，优先将会话创建到后端
    if (user) {
      try {
        console.log('Creating conversation on backend:', title, modelName);
        const res = await request.post('models/chat/conversation/', { title, model_name: modelName });
        console.log('Conversation created:', res.data);
        const newChat = { id: res.data.id, title: res.data.title, model_name: res.data.model_name, time: res.data.created_at };
        const updatedHistory = [newChat, ...chatHistory];
        setChatHistory(updatedHistory);
        // 同步到 localStorage
        saveToLocalStorage(updatedHistory);
        return newChat.id;
      } catch (err) {
        console.error('Failed to create conversation on backend, falling back to local:', err);
        // fallback to local
      }
    }

    // 未登录或后端失败时使用本地逻辑
    const newChat = {
      id: Date.now(),
      title,
      model_name: modelName,
      time: new Date().toLocaleString(),
    };
    const updatedHistory = [newChat, ...chatHistory];
    setChatHistory(updatedHistory);
    saveToLocalStorage(updatedHistory);
    return newChat.id;
  };

  // 更新聊天记录
  const updateChat = (id, updates) => {
    const updatedHistory = chatHistory.map(chat => 
      chat.id === id ? { ...chat, ...updates } : chat
    );
    setChatHistory(updatedHistory);
    saveToLocalStorage(updatedHistory);
  };

  // 删除聊天记录
  const deleteChat = async (id) => {
    if (user) {
      try {
        await request.delete(`models/chat/conversation/${id}/`);
      } catch (err) {
        console.error('Failed to delete conversation on backend:', err);
        // 即使后端失败，仍然删除前端显示
      }
    }
    const updatedHistory = chatHistory.filter(chat => chat.id !== id);
    setChatHistory(updatedHistory);
    saveToLocalStorage(updatedHistory);
  };

  // 清空所有聊天记录
  const clearHistory = async () => {
    if (user) {
      try {
        await request.delete('models/chat/conversation/delete_all/');
        // 后端清除成功后，清空前端状态
        setChatHistory([]);
        localStorage.removeItem('chatHistory');
        message.success('聊天记录已清空');
      } catch (err) {
        console.error('Failed to clear backend history:', err);
        console.error('Error details:', err.response?.data, err.response?.status);
        // 即使后端失败，仍然清空前端显示（因为可能是后端未部署或认证问题）
        setChatHistory([]);
        localStorage.removeItem('chatHistory');
        message.warning('后端清除失败，但已清空本地历史记录');
      }
      return;
    }
    // 未登录用户直接清空本地
    setChatHistory([]);
    localStorage.removeItem('chatHistory');
    message.success('聊天记录已清空');
  };

  return (
    <ChatContext.Provider value={{
      chatHistory,
      loading,
      addChat,
      updateChat,
      deleteChat,
      clearHistory
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export default ChatContext;