import apiClient from './apiClient';

/**
 * 获取模型列表
 * @param {object} params - 查询参数，例如 { search: 'gpt', type: '通用' }
 * @returns Promise
 */
export const getModels = (params) => {
  return apiClient.get('/models/', { params });
};
export const compareModels = (ids = []) => {
  return apiClient.get('models/compare/', { params: { ids: ids.join(',') } });
};
export const battleModels = ({prompt, modelA, modelB, isDirectChat = false}) => {
  const payload = {
    prompt,
    is_direct_chat: isDirectChat
  };
  
  if (isDirectChat) {
    payload.model_name = modelA;
  } else {
    payload.model_a = modelA;
    payload.model_b = modelB;
  }
  
  return apiClient.post('/models/battle/', payload);
}
/**
 * 评估单个模型
 * @param {string} modelName - 模型名称
 * @param {string} prompt - 用户输入的提示
 * @param {number|null} conversationId - 对话 ID,如果为 null 则创建新对话
 * @returns Promise - 返回 { response, conversation_id }
 */
export const evaluateModel = (modelName, prompt, conversationId = null) => {
  const payload = {
    model_name: modelName,
    prompt: prompt,
  };
  
  if (conversationId) {
    payload.conversation_id = conversationId;
  }
  
  return apiClient.post('/models/evaluate/', payload);
};
export const recordVote = (data) => {
  const payload = {
    model_a: data.modelA,
    model_b: data.modelB,
    prompt: data.prompt,
    winner: data.winner,
  };
  return apiClient.post('/models/record_vote/', payload);
}
export const getModel = (id) => {
  return apiClient.get(`models/${id}/`);
};

export const getLeaderboard = (metric = 'score') => {
  return apiClient.get('/models/leaderboard/', { params: { metric } });
};
