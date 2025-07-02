import React, { useEffect, useState, useCallback } from 'react';
import { Workout } from '../types/workout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { StoredWorkout } from '../lib/supabase';

interface WorkoutListProps {
  workouts: Workout[]; // Local workouts
}

export const WorkoutList: React.FC<WorkoutListProps> = ({ workouts }) => {
  const { user } = useAuth();
  const [storedWorkouts, setStoredWorkouts] = useState<StoredWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkouts = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error: dbError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (dbError) {
        throw dbError;
      }

      setStoredWorkouts(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching workouts:', err);
      setError('Failed to load your workouts.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // Set up real-time subscription to workouts table
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('workouts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'workouts', filter: `user_id=eq.${user.id}` },
        () => {
          // Refresh workouts when any change occurs
          fetchWorkouts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchWorkouts]);

  // Convert stored workouts to display format (already sorted by database query)
  const allWorkouts = storedWorkouts.map(sw => ({
    id: sw.id,
    type: sw.type,
    duration: sw.duration,
    date: sw.created_at,
    calories: sw.calories,
    notes: sw.notes || undefined,
    ai_analysis: sw.ai_analysis || undefined
  }));

  if (loading && !allWorkouts.length) {
    return <div className="workout-list">Loading your workouts...</div>;
  }

  return (
    <div className="workout-list">
      <h2>Your Workouts</h2>
      {error && <div className="error-message">{error}</div>}
      {allWorkouts.length === 0 ? (
        <p>No workouts recorded yet. Add your first workout above!</p>
      ) : (
        allWorkouts.map(workout => (
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