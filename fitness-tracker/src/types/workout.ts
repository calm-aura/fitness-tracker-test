export interface Workout {
  id: string;
  type: string;
  duration: number;
  date: string;
  calories: number;
  notes?: string;
  ai_analysis?: string;
}

export interface WorkoutInput {
  type: string;
  duration: number;
  calories: number;
  notes?: string;
} 