import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Workout } from '../types/workout';
import { useAuth } from '../contexts/AuthContext';
import { getWorkouts, Workout as BackendWorkout } from '../services/workoutService';

interface WorkoutListProps {
  workouts: Workout[]; // Local workouts for immediate updates
  onWorkoutsUpdate?: (workouts: Workout[]) => void; // Callback to update parent state
}

export const WorkoutList: React.FC<WorkoutListProps> = ({ workouts, onWorkoutsUpdate }) => {
  const { user } = useAuth();
  const [storedWorkouts, setStoredWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onWorkoutsUpdateRef = useRef(onWorkoutsUpdate);

  // Update ref when callback changes
  useEffect(() => {
    onWorkoutsUpdateRef.current = onWorkoutsUpdate;
  }, [onWorkoutsUpdate]);

  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('🔍 Fetching workouts for user:', user.id);
      const backendWorkouts = await getWorkouts(user.id);
      
      // Convert backend workouts to frontend format
      const convertedWorkouts: Workout[] = backendWorkouts.map(bw => ({
        id: bw.id.toString(),
        type: bw.type,
        duration: bw.duration,
        date: bw.created_at,
        calories: bw.calories,
        notes: bw.notes || undefined,
        ai_analysis: bw.ai_analysis || undefined
      }));

      setStoredWorkouts(convertedWorkouts);
      
      // Update parent component's workout list
      if (onWorkoutsUpdateRef.current) {
        onWorkoutsUpdateRef.current(convertedWorkouts);
      }
      
      setError(null);
      console.log('✅ Successfully loaded', convertedWorkouts.length, 'workouts');
    } catch (err) {
      console.error('❌ Error fetching workouts:', err);
      setError('Failed to load your workouts. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // Only depend on user.id

  useEffect(() => {
    if (user?.id) {
      fetchWorkouts();
    }
  }, [user?.id, fetchWorkouts]); // Include fetchWorkouts in dependencies

  // Combine local workouts (for immediate updates) with stored workouts
  // Remove duplicates by preferring local workouts (more recent)
  const localWorkoutIds = new Set(workouts.map(w => w.id));
  const combinedWorkouts = [
    ...workouts, // Local workouts first (most recent)
    ...storedWorkouts.filter(sw => !localWorkoutIds.has(sw.id)) // Stored workouts that aren't already local
  ];

  // Sort by date (most recent first)
  const sortedWorkouts = combinedWorkouts.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (loading) {
    return <div className="workout-list">Loading your workouts...</div>;
  }

  return (
    <div className="workout-list">
      <h2>Your Workouts</h2>
      {error && (
        <div className="error-message">
          {error}
          <button 
            onClick={fetchWorkouts}
            style={{ marginLeft: '10px', padding: '5px 10px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}
      {sortedWorkouts.length === 0 ? (
        <p>No workouts recorded yet. Add your first workout above!</p>
      ) : (
        sortedWorkouts.map(workout => (
          <div key={workout.id} className="workout-item">
            <h3>{workout.type}</h3>
            <p>Date: {new Date(workout.date).toLocaleDateString()}</p>
            <p>Duration: {workout.duration} minutes</p>
            <p>Calories Burned: {workout.calories}</p>
            {workout.notes && <p>Notes: {workout.notes}</p>}
            {workout.ai_analysis && (
              <div className="analysis-result">
                <h3>AI Analysis</h3>
                <p>{workout.ai_analysis}</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}; 