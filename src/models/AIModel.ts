export interface AIModel {
  id?: number;
  user_id: number;
  name: string;
  description?: string;
  code: string;
  language?: string;
  rating?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}
