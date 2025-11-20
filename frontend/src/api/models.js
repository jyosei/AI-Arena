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
 * 评估模型（统一接口，支持文本和多模态）
 * @param {string} modelName - 模型名称
 * @param {string} prompt - 文本提示
 * @param {string|null} conversationId - 对话ID
 * @param {File|null} imageFile - 上传的图片文件
 * @returns Promise
 */
export const evaluateModel = (modelName, prompt, conversationId, imageFile) => {
  
  // 检查是否存在图片文件。imageFile 应该是来自 antd beforeUpload 的原始 File 对象。
  if (imageFile && imageFile instanceof File) {
    
    // 如果有图片，必须使用 FormData
    const formData = new FormData();
    
    // 添加所有需要的字段
    formData.append('model_name', modelName);
    formData.append('prompt', prompt || ''); // 确保 prompt 即使为空也作为空字符串发送
    formData.append('conversation_id', conversationId || ''); // 确保 conversationId 存在
    
    // 将 File 对象添加到 FormData 中
    formData.append('image', imageFile, imageFile.name); 

    // 使用 apiClient 发送 FormData 请求
    // 关键：必须手动设置 Content-Type 为 multipart/form-data
    // 注意：axios 会自动处理 boundary，所以我们不需要自己设置完整的 Content-Type 头
    return apiClient.post('/models/evaluate/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

  } else {
    
    // 如果没有图片，或者 imageFile 不是一个 File 对象，则回退到 JSON 格式
    return apiClient.post('/models/evaluate/', {
      model_name: modelName,
      prompt: prompt,
      conversation_id: conversationId,
    });
  }
};
export const recordVote = (data) => {
  // --- 关键修改：截断 prompt 以防止超出数据库限制 ---
  const truncatedPrompt = data.prompt && data.prompt.length > 500 
    ? data.prompt.substring(0, 500) 
    : data.prompt;

  const payload = {
    model_a: data.model_a,
    model_b: data.model_b,
    prompt: truncatedPrompt, // 使用截断后的 prompt
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
