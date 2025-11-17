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
  
/**
 * 评估单个模型
 * @param {string} modelName - 模型名称
 * @param {string} prompt - 用户输入的提示
 * @param {number|null} conversationId - 对话 ID,如果为 null 则创建新对话
 * @param {boolean} is_battle - 是否为对战模式
 * @returns Promise - 返回 { response, conversation_id }
 */
export const evaluateModel = async (modelName, prompt, conversationId = null, is_battle = false) => {
  const payload = {
    model_name: modelName, // 关键修复：将 'model' 改为 'model_name'
    prompt: prompt,
    conversation_id: conversationId,
    is_battle: is_battle,
  };
  return apiClient.post('/models/evaluate/', payload);
};

export const recordVote = (data) => {
  const payload = {
    model_a: data.model_a,
    model_b: data.model_b,
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

// --- 新增的图片生成 API 函数 ---

/**
 * 提交图片生成任务
 * @param {string} prompt 
 * @returns Promise - 返回 { task_id }
 */
export const generateImage = (prompt) => {
  return apiClient.post('/models/generate-image/', { prompt });
};

/**
 * 查询图片生成状态
 * @param {string} taskId 
 * @returns Promise - 返回 { status, image_url? }
 */
export const getImageStatus = (taskId) => {
  return apiClient.get('/models/get-image-status/', { params: { task_id: taskId } });
};
