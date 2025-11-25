import express from 'express';
import { PostDAO } from '../dao/PostDAO';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const postDAO = new PostDAO();

// 获取所有帖子（无需认证）
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const posts = await postDAO.findAll(limit, offset);
    res.json({ data: posts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个帖子（无需认证）
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await postDAO.incrementViews(id);
    const post = await postDAO.findById(id);
    
    if (!post) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    
    res.json({ data: post });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 创建帖子（需要认证）
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '请提供标题和内容' });
    }

    const postId = await postDAO.create({
      user_id: req.user.id,
      title,
      content
    });

    const post = await postDAO.findById(postId);
    res.status(201).json({
      message: '发帖成功',
      data: post
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的帖子（需要认证）
router.get('/user/my', authenticate, async (req: AuthRequest, res) => {
  try {
    const posts = await postDAO.findByUserId(req.user.id);
    res.json({ data: posts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除帖子（需要认证）
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const post = await postDAO.findById(id);

    if (!post) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除此帖子' });
    }

    await postDAO.delete(id);
    res.json({ message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
