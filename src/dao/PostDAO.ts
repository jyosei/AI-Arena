import db from '../database/connection';
import { Post } from '../models/Post';

export class PostDAO {
  async create(post: Post): Promise<number> {
    const sql = 'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)';
    const result = await db.execute(sql, [post.user_id, post.title, post.content]);
    return result.insertId;
  }

  async findById(id: number): Promise<Post | null> {
    const sql = `
      SELECT p.*, u.username 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE p.id = ?
    `;
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findAll(limit: number = 20, offset: number = 0): Promise<Post[]> {
    const sql = `
      SELECT p.*, u.username 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    return await db.query(sql, [limit, offset]);
  }

  async findByUserId(userId: number): Promise<Post[]> {
    const sql = `
      SELECT p.*, u.username 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE p.user_id = ? 
      ORDER BY p.created_at DESC
    `;
    return await db.query(sql, [userId]);
  }

  async update(id: number, post: Partial<Post>): Promise<boolean> {
    const fields = Object.keys(post).map(key => `${key} = ?`).join(', ');
    const values = Object.values(post);
    const sql = `UPDATE posts SET ${fields} WHERE id = ?`;
    const result = await db.execute(sql, [...values, id]);
    return result.affectedRows > 0;
  }

  async delete(id: number): Promise<boolean> {
    const sql = 'DELETE FROM posts WHERE id = ?';
    const result = await db.execute(sql, [id]);
    return result.affectedRows > 0;
  }

  async incrementViews(id: number): Promise<boolean> {
    const sql = 'UPDATE posts SET views = views + 1 WHERE id = ?';
    const result = await db.execute(sql, [id]);
    return result.affectedRows > 0;
  }
}
