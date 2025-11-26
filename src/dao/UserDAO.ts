import db from '../database/connection';
import { User } from '../models/User';

export class UserDAO {
  async create(user: User): Promise<number> {
    const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
    const result = await db.execute(sql, [user.username, user.email, user.password_hash]);
    return result.insertId;
  }

  async findById(id: number): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE username = ?';
    const rows = await db.query(sql, [username]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const rows = await db.query(sql, [email]);
    return rows.length > 0 ? rows[0] : null;
  }

  async update(id: number, user: Partial<User>): Promise<boolean> {
    const fields = Object.keys(user).map(key => `${key} = ?`).join(', ');
    const values = Object.values(user);
    const sql = `UPDATE users SET ${fields} WHERE id = ?`;
    const result = await db.execute(sql, [...values, id]);
    return result.affectedRows > 0;
  }

  async updateRating(id: number, rating: number): Promise<boolean> {
    const sql = 'UPDATE users SET rating = ? WHERE id = ?';
    const result = await db.execute(sql, [rating, id]);
    return result.affectedRows > 0;
  }

  async getTopUsers(limit: number = 10): Promise<User[]> {
    const sql = 'SELECT * FROM users ORDER BY rating DESC LIMIT ?';
    return await db.query(sql, [limit]);
  }
}
