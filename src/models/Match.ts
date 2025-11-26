export interface Match {
  id?: number;
  player1_id: number;
  player2_id: number;
  winner_id?: number;
  game_type: string;
  game_state?: any;
  moves_count?: number;
  duration_ms?: number;
  created_at?: Date;
}
