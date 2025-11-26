import db from '../database/connection';
import { AIModel } from '../models/AIModel';

export class AIModelDAO {
  async create(model: AIModel): Promise<number> {
    const sql = 'INSERT INTO ai_models (user_id, name, description, code, language) VALUES (?, ?, ?, ?, ?)';
    const result = await db.execute(sql, [model.user_id, model.name, model.description, model.code, model.language]);
    return result.insertId;
  }

  async findById(id: number): Promise<AIModel | null> {
    const sql = 'SELECT * FROM ai_models WHERE id = ?';
    const rows = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByUserId(userId: number): Promise<AIModel[]> {
    const sql = 'SELECT * FROM ai_models WHERE user_id = ? ORDER BY created_at DESC';
    return await db.query(sql, [userId]);
  }

  async update(id: number, model: Partial<AIModel>): Promise<boolean> {
    const fields = Object.keys(model).map(key => `${key} = ?`).join(', ');
    const values = Object.values(model);
    const sql = `UPDATE ai_models SET ${fields} WHERE id = ?`;
    const result = await db.execute(sql, [...values, id]);
    return result.affectedRows > 0;
  }

  async updateStats(id: number, wins: number, losses: number, draws: number, rating: number): Promise<boolean> {
    const sql = 'UPDATE ai_models SET wins = ?, losses = ?, draws = ?, rating = ? WHERE id = ?';
    const result = await db.execute(sql, [wins, losses, draws, rating, id]);
    return result.affectedRows > 0;
  }

  async getTopModels(limit: number = 10): Promise<AIModel[]> {
    const sql = 'SELECT * FROM ai_models WHERE is_active = TRUE ORDER BY rating DESC LIMIT ?';
    return await db.query(sql, [limit]);
  }

  async delete(id: number): Promise<boolean> {
    const sql = 'DELETE FROM ai_models WHERE id = ?';
    const result = await db.execute(sql, [id]);
    return result.affectedRows > 0;
  }
}
