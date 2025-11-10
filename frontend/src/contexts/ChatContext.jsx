import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // 从本地存储加载聊天记录
  useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    }
  }, []);

  // 保存聊天记录到本地存储
  const saveToLocalStorage = (history) => {
    try {
      localStorage.setItem('chatHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  // 添加新的聊天记录
  const addChat = (title) => {
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
  const deleteChat = (id) => {
    const updatedHistory = chatHistory.filter(chat => chat.id !== id);
    setChatHistory(updatedHistory);
    saveToLocalStorage(updatedHistory);
  };

  // 清空所有聊天记录
  const clearHistory = () => {
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