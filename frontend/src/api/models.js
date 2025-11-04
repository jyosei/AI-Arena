import request from './request';

export const getModels = (params) => {
  return request.get('models/', { params });
};

export const getModel = (id) => {
  return request.get(`models/${id}/`);
};

export const getLeaderboard = (metric = 'score') => {
  return request.get('leaderboard/', { params: { metric } });
};

export const compareModels = (ids = []) => {
  return request.get('models/compare/', { params: { ids: ids.join(',') } });
};
