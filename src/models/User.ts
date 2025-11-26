export interface User {
  id?: number;
  username: string;
  email: string;
  password_hash?: string;
  rating?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  created_at?: Date;
  updated_at?: Date;
}
