import React, { useState } from 'react';
import { Workout } from '../types/workout';
import { useAuth } from '../contexts/AuthContext';
import { checkSubscriptionStatus } from '../services/stripeService';
import { createWorkout, getAIAnalysis } from '../services/workoutService';

interface WorkoutFormProps {
  onAddWorkout: (workout: Workout) => void;
}

export const WorkoutForm: React.FC<WorkoutFormProps> = ({ onAddWorkout }) => {
  const { user } = useAuth();
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setType('');
    setDuration('');
    setCalories('');
    setNotes('');
    setAnalysis(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to save workouts');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let aiAnalysis = null;

      // Get AI analysis if notes are provided AND user has subscription
      if (notes.trim()) {
        try {
          console.log('=== AI ANALYSIS FLOW START ===');
          console.log('Notes provided:', notes.trim());
          console.log('User ID:', user.id);
          console.log('Checking subscription status for AI analysis...');
          
          const subscriptionStatus = await checkSubscriptionStatus(user.id);
          console.log('User subscription status:', subscriptionStatus);
          const hasSubscription = subscriptionStatus.isSubscribed;
          console.log('User has subscription:', hasSubscription);
          
          if (hasSubscription) {
            console.log('✅ User has subscription, calling AI analysis...');
            aiAnalysis = await getAIAnalysis(notes.trim(), user.id);
            setAnalysis(aiAnalysis);
            console.log('✅ AI analysis completed:', aiAnalysis);
          } else {
            console.log('❌ User does not have subscription, showing premium message');
            const premiumMessage = '🔒 AI Analysis is a premium feature. Subscribe to get personalized workout insights!';
            setAnalysis(premiumMessage);
            aiAnalysis = premiumMessage;
            console.log('❌ Set premium message:', premiumMessage);
          }
          console.log('=== AI ANALYSIS FLOW END ===');
        } catch (err) {
          console.error('❌ AI Analysis error:', err);
          // Don't set error here, just log it - we'll still save the workout
        }
      } else {
        console.log('No notes provided, skipping AI analysis');
      }

      // Save workout using backend service
      const workoutData = {
        user_id: user.id,
        type,
        duration: Number(duration),
        calories: Number(calories),
        notes: notes.trim() || undefined,
        ai_analysis: aiAnalysis || undefined
      };

      const savedWorkout = await createWorkout(workoutData);

      // Convert to frontend Workout format
      const workout: Workout = {
        id: savedWorkout.id.toString(),
        type: savedWorkout.type,
        duration: savedWorkout.duration,
        date: savedWorkout.created_at,
        calories: savedWorkout.calories,
        notes: savedWorkout.notes || undefined,
        ai_analysis: savedWorkout.ai_analysis || undefined
      };

      // Update local state
      onAddWorkout(workout);
      resetForm();
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Failed to save the workout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="workout-form">
      <h2>Log New Workout</h2>
      
      <div className="form-group">
        <input
          type="text"
          placeholder="Workout type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <input
          type="number"
          placeholder="Duration (minutes)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
          min="1"
        />
      </div>

      <div className="form-group">
        <input
          type="number"
          placeholder="Calories burned"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          required
          min="0"
        />
      </div>

      <div className="form-group">
        <textarea
          placeholder="Add your workout notes (Premium users get AI analysis)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {analysis && (
        <div className="analysis-result">
          <h3>AI Analysis:</h3>
          <p>{analysis}</p>
        </div>
      )}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Workout'}
      </button>
    </form>
  );
}; 