const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

export interface WorkoutData {
  user_id: string;
  type: string;
  duration: number;
  calories: number;
  notes?: string;
  ai_analysis?: string;
}

export interface Workout extends WorkoutData {
  id: number;
  created_at: string;
  updated_at?: string;
}

// Get all workouts for a user
export const getWorkouts = async (userId: string): Promise<Workout[]> => {
  try {
    console.log('🔍 Fetching workouts for user:', userId);
    const response = await fetch(`${SERVER_URL}/api/workouts/${userId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch workouts: ${response.statusText}`);
    }
    
    const workouts = await response.json();
    console.log('✅ Fetched workouts:', workouts.length);
    return workouts;
  } catch (error) {
    console.error('❌ Error fetching workouts:', error);
    throw error;
  }
};

// Create a new workout
export const createWorkout = async (workoutData: WorkoutData): Promise<Workout> => {
  try {
    console.log('💪 Creating workout:', workoutData);
    const response = await fetch(`${SERVER_URL}/api/workouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workoutData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to create workout: ${response.statusText}`);
    }
    
    const workout = await response.json();
    console.log('✅ Workout created successfully:', workout.id);
    return workout;
  } catch (error) {
    console.error('❌ Error creating workout:', error);
    throw error;
  }
};

// Update a workout
export const updateWorkout = async (id: number, workoutData: Partial<WorkoutData>): Promise<Workout> => {
  try {
    console.log('🔄 Updating workout:', id, workoutData);
    const response = await fetch(`${SERVER_URL}/api/workouts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workoutData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to update workout: ${response.statusText}`);
    }
    
    const workout = await response.json();
    console.log('✅ Workout updated successfully:', workout.id);
    return workout;
  } catch (error) {
    console.error('❌ Error updating workout:', error);
    throw error;
  }
};

// Delete a workout
export const deleteWorkout = async (id: number, userId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting workout:', id);
    const response = await fetch(`${SERVER_URL}/api/workouts/${id}?user_id=${userId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to delete workout: ${response.statusText}`);
    }
    
    console.log('✅ Workout deleted successfully:', id);
  } catch (error) {
    console.error('❌ Error deleting workout:', error);
    throw error;
  }
};

// Get AI analysis for workout notes
export const getAIAnalysis = async (notes: string, userId: string): Promise<string> => {
  try {
    console.log('🤖 Requesting AI analysis for user:', userId);
    const response = await fetch(`${SERVER_URL}/api/ai-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes, userId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to get AI analysis: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ AI analysis received');
    return result.analysis;
  } catch (error) {
    console.error('❌ Error getting AI analysis:', error);
    throw error;
  }
}; 