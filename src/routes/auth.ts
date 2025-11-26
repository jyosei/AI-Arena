import express from 'express';
import { AuthService } from '../services/AuthService';

const router = express.Router();
const authService = new AuthService();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '请提供用户名、邮箱和密码' });
    }

    const result = await authService.register(username, email, password);
    res.status(201).json({
      message: '注册成功',
      data: result
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请提供用户名和密码' });
    }

    const result = await authService.login(username, password);
    res.json({
      message: '登录成功',
      data: result
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

export default router;
