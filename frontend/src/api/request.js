// 文件：request.js (请确认已修改)

import axios from 'axios';

// 必须将 localhost 更改为 Docker Compose 服务名称 'backend'
const request = axios.create({ baseURL: 'http://backend:8000/api/' }); 

export default request;