import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✓ 服务器运行在 http://localhost:${PORT}`);
  console.log(`✓ API文档:`);
  console.log(`  - POST /api/auth/register - 用户注册`);
  console.log(`  - POST /api/auth/login - 用户登录`);
  console.log(`  - GET  /api/posts - 获取所有帖子`);
  console.log(`  - POST /api/posts - 创建帖子（需要token）`);
  console.log(`  - GET  /api/posts/user/my - 获取我的帖子（需要token）`);
});
