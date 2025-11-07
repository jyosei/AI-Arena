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
export const battleModels = ({prompt,modelA,modelB}) =>{
  const payload ={
    prompt,
  };
  if(modelA && modelB){
    payload.model_a = modelA;
    payload.model_b = modelB;
  }
  return apiClient.post('/models/battle/' , payload);
}
/**
 * 评估单个模型
 * @param {object} data
 * @param {string} modelName - 模型名称
 * @param {string} prompt - 用户输入的提示
 * @param {string} [data.modelA]
 * @param {string} [data.modelB]
 * @param {string} [data.winner]
 * @returns Promise
 */
export const evaluateModel = (modelName, prompt) => {
  return apiClient.post('/models/evaluate/', {
    model_name: modelName,
    prompt: prompt,
  });
};
export const recordVote = (data) => {
  const payload = {
    model_a: data.modelA,
    model_b: data.modelB,
    prompt: data.prompt,
    winner: data.winner,
  };
  return apiClient.post('/battles/record_vote/', payload);
}
export const getModel = (id) => {
  return apiClient.get(`models/${id}/`);
};

export const getLeaderboard = (metric = 'score') => {
  return apiClient.get('leaderboard/', { params: { metric } });
};
