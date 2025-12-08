import db from '../database/connection';
import { Match } from '../models/Match';

export class MatchDAO {
  async create(match: Match): Promise<number> {
    const sql = 'INSERT INTO matches (player1_id, player2_id, winner_id, game_type, game_state, moves_count, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const result = await db.execute(sql, [
      match.player1_id,
      match.player2_id,
      match.winner_id,
      match.game_type,
      JSON.stringify(match.game_state),
      match.moves_count,
      match.duration_ms
    ]);
    return result.insertId;
  }

  async findById(id: number): Promise<Match | null> {
    const sql = 'SELECT * FROM matches WHERE id = ?';
    const rows = await db.query(sql, [id]);
    if (rows.length > 0) {
      const match = rows[0];
      match.game_state = JSON.parse(match.game_state);
      return match;
    }
    return null;
  }

  async findByModelId(modelId: number, limit: number = 20): Promise<Match[]> {
    const sql = 'SELECT * FROM matches WHERE player1_id = ? OR player2_id = ? ORDER BY created_at DESC LIMIT ?';
    const rows = await db.query(sql, [modelId, modelId, limit]);
    return rows.map((row: any) => ({
      ...row,
      game_state: JSON.parse(row.game_state)
    }));
  }

  async getRecentMatches(limit: number = 20): Promise<Match[]> {
    const sql = 'SELECT * FROM matches ORDER BY created_at DESC LIMIT ?';
    const rows = await db.query(sql, [limit]);
    return rows.map((row: any) => ({
      ...row,
      game_state: JSON.parse(row.game_state)
    }));
  }

  async getMatchStats(modelId: number): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN winner_id IS NULL THEN 1 ELSE 0 END) as draws,
        AVG(duration_ms) as avg_duration
      FROM matches 
      WHERE player1_id = ? OR player2_id = ?
    `;
    const rows = await db.query(sql, [modelId, modelId, modelId]);
    return rows[0];
  }
}
