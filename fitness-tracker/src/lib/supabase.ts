import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kmkkystibntmkoxgvqbe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtta2t5c3RpYm50bWtveGd2cWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMDM4MzQsImV4cCI6MjA2Njg3OTgzNH0.HMTaeau4Vq-hKJ-YGQVIIEoryM0FNaSW8mMgIu4_fvA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For testing: Clear all workout data (admin function)
export const clearAllWorkoutData = async () => {
  try {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records (neq with impossible ID)
    
    if (error) {
      console.error('Error clearing workout data:', error);
      return { success: false, error: error.message };
    }
    
    console.log('All workout data cleared successfully');
    return { success: true };
  } catch (err) {
    console.error('Error clearing workout data:', err);
    return { success: false, error: 'Unknown error occurred' };
  }
};

// Types for database tables
export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  updated_at: string;
}

export interface StoredWorkout {
  id: string;
  user_id: string;
  type: string;
  duration: number;
  calories: number;
  notes?: string;
  ai_analysis?: string;
  created_at: string;
} 