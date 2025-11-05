// Test mapping logic from frontend/src/pages/Leaderboard.jsx

function mapLeaderboardResponse(data){
  const arr = data || [];
  const mapped = arr.map((item, idx) => ({
    id: item && (item.id ?? idx),
    rank: item && (item.rank ?? idx + 1),
    name: item && (item.name || item.model_name || item.id || `模型-${idx + 1}`),
    owner_name: item && (item.owner_name || item.owner || '-'),
    value: item && (item.value ?? item.score ?? '-'),
  }));
  return mapped;
}

const samples = {
  real_leaderboard: [
    {id:10, name:'A', owner_name:'X', value: 99, rank:1},
    {id:11, name:'B', owner_name:'Y', value: 88, rank:2},
  ],
  models_list: [
    {id:1, name:'gpt-3.5-turbo', owner_name:'OpenAI'},
    {id:2, name:'glm-4', owner_name:'智谱AI'},
  ],
  empty: [],
  null_response: null,
  malformed: [
    {},
    {model_name:'weird'},
    {id:null, owner:'someone'}
  ]
};

for(const [k,v] of Object.entries(samples)){
  console.log('---', k, '---');
  try{
    const out = mapLeaderboardResponse(v);
    console.log(JSON.stringify(out, null, 2));
  }catch(e){
    console.error('Error mapping', e);
  }
}
