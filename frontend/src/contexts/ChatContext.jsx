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
      }
    };

    if (user) {
      // 登录用户：尝试从后端获取用户专属历史
      request.get('models/chat/history/')
        .then(res => {
          // 将后端数据适配为前端历史记录项格式（id/title/time）
          const adapted = res.data.map(item => ({ id: item.id, title: item.title, time: item.created_at }));
          setChatHistory(adapted);
        })
        .catch(err => {
          console.error('Failed to fetch chat history from backend, fallback to local:', err);
          loadLocal();
        });
    } else {
      // 未登录用户：使用本地存储
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
  const addChat = async (title) => {
    // 如果用户已登录，优先将会话创建到后端
    if (user) {
      try {
        const res = await request.post('models/chat/conversation/', { title });
        const newChat = { id: res.data.id, title: res.data.title, time: res.data.created_at };
        const updatedHistory = [newChat, ...chatHistory];
        setChatHistory(updatedHistory);
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
      // 后端未实现单个删除接口，此处先在客户端移除并不调用后端
      // 可在未来扩展为调用 DELETE /chat/conversation/<id>/
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