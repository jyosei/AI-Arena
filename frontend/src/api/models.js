import apiClient from './apiClient'; // 假设你有一个配置好的 apiClient

export const getModels = (params) => {
  return apiClient.get('/models/', { params });
};

export const getModel = (id) => {
  return apiClient.get(`models/${id}/`);
};

export const getLeaderboard = (metric = 'score') => {
  return apiClient.get('leaderboard/', { params: { metric } });
};

export const compareModels = (ids = []) => {
  return apiClient.get('models/compare/', { params: { ids: ids.join(',') } });
};

// 新增：调用模型评估接口的函数
export const evaluateModel = (modelName, prompt) => {
  // apiClient 应该被配置为自动从 localStorage 读取并添加 Authorization 头
  return apiClient.post('/models/evaluate/', {
    model_name: modelName,
    prompt: prompt,
  });
};
