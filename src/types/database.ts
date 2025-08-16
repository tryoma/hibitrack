// types/database.ts
export interface Database {
  public: {
    Tables: {
      diaries: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          diary_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          content: string;
          diary_date: string;
        };
        Update: {
          content?: string;
          diary_date?: string;
        };
      };
      routines: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          days_of_week: number[];
          time_of_day: 'morning' | 'afternoon' | 'evening' | 'anytime';
          is_quantifiable: boolean;
          unit: string | null;
          target_value: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          description?: string;
          days_of_week?: number[];
          time_of_day?: 'morning' | 'afternoon' | 'evening' | 'anytime';
          is_quantifiable?: boolean;
          unit?: string;
          target_value?: number;
        };
        Update: {
          name?: string;
          description?: string;
          days_of_week?: number[];
          time_of_day?: 'morning' | 'afternoon' | 'evening' | 'anytime';
          is_quantifiable?: boolean;
          unit?: string;
          target_value?: number;
        };
      };
      routine_records: {
        Row: {
          id: string;
          routine_id: string;
          user_id: string;
          record_date: string;
          is_completed: boolean;
          actual_value: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          routine_id: string;
          user_id: string;
          record_date: string;
          is_completed?: boolean;
          actual_value?: number;
          notes?: string;
        };
        Update: {
          is_completed?: boolean;
          actual_value?: number;
          notes?: string;
        };
      };
    };
  };
}

export type Routine = Database['public']['Tables']['routines']['Row'];
