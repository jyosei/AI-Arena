#!/usr/bin/env node
/**
 * AI-Arena 前端端到端测试脚本
 * 
 * 需要安装:
 *   npm install --save-dev playwright @playwright/test
 *   npm install --save-dev axios
 * 
 * 运行方式:
 *   npm run test:e2e
 *   npm run test:e2e:ui
 */

const axios = require('axios');

// API基础URL
const API_BASE_URL = process.env.API_URL || 'http://82.157.56.206/api';
const APP_BASE_URL = process.env.APP_URL || 'http://82.157.56.206';

// 测试用户凭证
const TEST_USER = {
  username: `testuser_${Date.now()}`,
  password: 'TestPassword123',
  email: `test_${Date.now()}@example.com`
};

/**
 * API客户端
 */
class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    this.client.defaults.headers.Authorization = `Bearer ${token}`;
  }

  async register(username, password, email) {
    const response = await this.client.post('/users/register/', {
      username,
      password,
      email
    });
    return response.data;
  }

  async login(username, password) {
    const response = await this.client.post('/token/', {
      username,
      password
    });
    this.setToken(response.data.access);
    return response.data;
  }

  async getProfile() {
    const response = await this.client.get('/users/profile/');
    return response.data;
  }

  async updateProfile(data) {
    const response = await this.client.patch('/users/profile/', data);
    return response.data;
  }

  async getCategories() {
    const response = await this.client.get('/forum/categories/');
    return response.data;
  }

  async createPost(title, content, categoryId) {
    const response = await this.client.post('/forum/posts/', {
      title,
      content,
      category: categoryId,
      status: 'published'
    });
    return response.data;
  }

  async getPosts(page = 1, pageSize = 10) {
    const response = await this.client.get('/forum/posts/', {
      params: { page, page_size: pageSize }
    });
    return response.data;
  }

  async getPost(postId) {
    const response = await this.client.get(`/forum/posts/${postId}/`);
    return response.data;
  }

  async deletePost(postId) {
    await this.client.delete(`/forum/posts/${postId}/`);
  }

  async likePost(postId) {
    const response = await this.client.post(`/forum/posts/${postId}/like/`);
    return response.data;
  }

  async unlikePost(postId) {
    await this.client.delete(`/forum/posts/${postId}/like/`);
  }

  async createComment(postId, content, parentId = null) {
    const data = { content };
    if (parentId) {
      data.parent = parentId;
    }
    const response = await this.client.post(`/forum/posts/${postId}/comments/`, data);
    return response.data;
  }

  async getComments(postId) {
    const response = await this.client.get(`/forum/posts/${postId}/comments/`);
    return response.data;
  }

  async followUser(userId) {
    const response = await this.client.post(`/users/${userId}/follow/`);
    return response.data;
  }

  async unfollowUser(userId) {
    await this.client.delete(`/users/${userId}/follow/`);
  }
}

/**
 * 测试套件
 */
class TestSuite {
  constructor() {
    this.client = new APIClient();
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async test(name, fn) {
    try {
      await fn();
      this.results.passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ test: name, error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(80));
    console.log('测试结果摘要');
    console.log('='.repeat(80));
    console.log(`✅ 通过: ${this.results.passed}`);
    console.log(`❌ 失败: ${this.results.failed}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n失败的测试:');
      this.results.errors.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
    }
    
    const total = this.results.passed + this.results.failed;
    const percentage = total > 0 ? ((this.results.passed / total) * 100).toFixed(2) : 0;
    console.log(`\n总体通过率: ${percentage}%`);
  }
}

/**
 * 断言函数
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `期望 ${expected}，实际 ${actual}`);
  }
}

function assertExists(value, message) {
  if (!value) {
    throw new Error(message || '值不存在');
  }
}

function assertGreater(value, min, message) {
  if (value <= min) {
    throw new Error(message || `期望值大于 ${min}，实际 ${value}`);
  }
}

/**
 * 运行测试
 */
async function runTests() {
  const suite = new TestSuite();
  const api = suite.client;

  console.log('\n' + '🧪 '.repeat(30));
  console.log('AI-Arena 前端端到端测试套件');
  console.log('🧪 '.repeat(30) + '\n');

  // ====== 用户认证测试 ======
  console.log('\n📝 用户认证测试');
  console.log('-'.repeat(80));

  await suite.test('用户注册', async () => {
    const user = await api.register(
      TEST_USER.username,
      TEST_USER.password,
      TEST_USER.email
    );
    assertExists(user.id, '用户ID不存在');
    assertEqual(user.username, TEST_USER.username, '用户名不匹配');
  });

  await suite.test('用户登录', async () => {
    const tokens = await api.login(TEST_USER.username, TEST_USER.password);
    assertExists(tokens.access, 'Access token不存在');
    assertExists(tokens.refresh, 'Refresh token不存在');
  });

  // ====== 用户资料测试 ======
  console.log('\n👤 用户资料测试');
  console.log('-'.repeat(80));

  await suite.test('获取用户资料', async () => {
    const profile = await api.getProfile();
    assertEqual(profile.username, TEST_USER.username, '用户名不匹配');
  });

  await suite.test('更新用户资料', async () => {
    const updated = await api.updateProfile({
      description: '这是测试用户的描述'
    });
    assertEqual(updated.description, '这是测试用户的描述', '描述未更新');
  });

  // ====== 论坛基本功能测试 ======
  console.log('\n💬 论坛基本功能测试');
  console.log('-'.repeat(80));

  let postId = null;
  let categoryId = null;

  await suite.test('获取论坛分类', async () => {
    const categories = await api.getCategories();
    assertGreater(categories.length, 0, '分类列表为空');
    categoryId = categories[0].id;
  });

  await suite.test('创建论坛帖子', async () => {
    const post = await api.createPost(
      'E2E测试帖子',
      '这是一个端到端测试创建的帖子内容',
      categoryId
    );
    assertExists(post.id, '帖子ID不存在');
    assertEqual(post.title, 'E2E测试帖子', '帖子标题不匹配');
    postId = post.id;
  });

  await suite.test('获取帖子列表', async () => {
    const posts = await api.getPosts();
    assertExists(posts.results, '帖子列表不存在');
    assertGreater(posts.results.length, 0, '帖子列表为空');
  });

  await suite.test('获取帖子详情', async () => {
    const post = await api.getPost(postId);
    assertEqual(post.id, postId, '帖子ID不匹配');
  });

  // ====== 点赞功能测试 ======
  console.log('\n👍 点赞功能测试');
  console.log('-'.repeat(80));

  await suite.test('点赞帖子', async () => {
    await api.likePost(postId);
    const post = await api.getPost(postId);
    assertGreater(post.like_count, 0, '点赞数未增加');
  });

  await suite.test('取消点赞', async () => {
    await api.unlikePost(postId);
    const post = await api.getPost(postId);
    assertEqual(post.like_count, 0, '点赞数未减少');
  });

  // ====== 评论功能测试 ======
  console.log('\n💭 评论功能测试');
  console.log('-'.repeat(80));

  let commentId = null;

  await suite.test('创建一级评论', async () => {
    const comment = await api.createComment(postId, '这是一条测试评论');
    assertExists(comment.id, '评论ID不存在');
    assertEqual(comment.content, '这是一条测试评论', '评论内容不匹配');
    commentId = comment.id;
  });

  await suite.test('获取评论列表', async () => {
    const comments = await api.getComments(postId);
    assertGreater(comments.length, 0, '评论列表为空');
  });

  await suite.test('创建嵌套评论（回复）', async () => {
    const reply = await api.createComment(
      postId,
      '这是一条回复',
      commentId
    );
    assertExists(reply.id, '回复ID不存在');
    assertEqual(reply.parent, commentId, '父评论ID不匹配');
  });

  // ====== 用户关注测试 ======
  console.log('\n🔗 用户关注测试');
  console.log('-'.repeat(80));

  // 创建第二个用户
  const user2 = {
    username: `testuser2_${Date.now()}`,
    password: 'TestPassword123',
    email: `test2_${Date.now()}@example.com`
  };

  let user2Id = null;
  const api2 = new APIClient();

  await suite.test('创建第二个用户', async () => {
    const user = await api2.register(user2.username, user2.password, user2.email);
    assertExists(user.id, '用户ID不存在');
    user2Id = user.id;
  });

  await suite.test('关注用户', async () => {
    await api.followUser(user2Id);
    // 验证关注成功
  });

  await suite.test('取消关注', async () => {
    await api.unfollowUser(user2Id);
    // 验证取消关注成功
  });

  // ====== 帖子删除测试 ======
  console.log('\n🗑️  删除测试');
  console.log('-'.repeat(80));

  await suite.test('删除帖子', async () => {
    // 创建一个新帖子用于删除
    const post = await api.createPost(
      '待删除的帖子',
      '内容',
      categoryId
    );
    const id = post.id;
    
    // 删除帖子
    await api.deletePost(id);
    
    // 验证帖子已删除（应该404）
    try {
      await api.getPost(id);
      throw new Error('帖子仍然存在');
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }
  });

  // ====== 性能测试 ======
  console.log('\n⚡ 性能测试');
  console.log('-'.repeat(80));

  await suite.test('批量创建帖子', async () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await api.createPost(
        `性能测试帖子${i}`,
        `内容${i}`,
        categoryId
      );
    }
    
    const duration = Date.now() - startTime;
    console.log(`    创建10个帖子耗时: ${duration}ms`);
  });

  await suite.test('大文本评论', async () => {
    const largeText = 'A'.repeat(5000);
    const comment = await api.createComment(postId, largeText);
    assertEqual(comment.content.length, 5000, '大文本评论长度不匹配');
  });

  // ====== 错误处理测试 ======
  console.log('\n❌ 错误处理测试');
  console.log('-'.repeat(80));

  await suite.test('访问不存在的帖子', async () => {
    try {
      await api.getPost(99999);
      throw new Error('应该返回404');
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }
  });

  await suite.test('无效的登录凭证', async () => {
    const api3 = new APIClient();
    try {
      await api3.login('nonexistent', 'wrongpassword');
      throw new Error('应该返回401');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw error;
      }
    }
  });

  await suite.test('缺少必要字段的创建请求', async () => {
    try {
      const response = await suite.client.client.post('/forum/posts/', {
        title: '缺少内容'
        // 缺少content和category
      });
      throw new Error('应该返回400');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw error;
      }
    }
  });

  // 打印结果
  suite.printResults();

  // 返回退出码
  process.exit(suite.results.failed > 0 ? 1 : 0);
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('测试套件错误:', error);
    process.exit(1);
  });
}

module.exports = { APIClient, TestSuite };
