export interface Post {
  id?: number;
  user_id: number;
  title: string;
  content: string;
  likes?: number;
  views?: number;
  created_at?: Date;
  updated_at?: Date;
  username?: string; // 关联查询时使用
}
