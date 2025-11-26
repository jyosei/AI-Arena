import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserDAO } from '../dao/UserDAO';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_this';

export class AuthService {
  private userDAO: UserDAO;

  constructor() {
    this.userDAO = new UserDAO();
  }

  async register(username: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const existingUser = await this.userDAO.findByUsername(username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    const existingEmail = await this.userDAO.findByEmail(email);
    if (existingEmail) {
      throw new Error('邮箱已被注册');
    }

    const password_hash = await bcrypt.hash(password, 10);

    const userId = await this.userDAO.create({
      username,
      email,
      password_hash
    });

    const user = await this.userDAO.findById(userId);
    if (!user) {
      throw new Error('创建用户失败');
    }

    const token = this.generateToken(user);
    delete user.password_hash;

    return { user, token };
  }

  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    const user = await this.userDAO.findByUsername(username);
    if (!user) {
      throw new Error('用户名或密码错误');
    }

    const isValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isValid) {
      throw new Error('用户名或密码错误');
    }

    const token = this.generateToken(user);
    delete user.password_hash;

    return { user, token };
  }

  private generateToken(user: User): string {
    const payload = { 
      id: user.id, 
      username: user.username 
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('无效的token');
    }
  }
}
