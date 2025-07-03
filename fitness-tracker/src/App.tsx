import React, { useState } from 'react';
import './App.css';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutList } from './components/WorkoutList';
import { Auth } from './components/Auth';
import { PremiumFeatures } from './components/PremiumFeatures';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Workout } from './types/workout';


function AppContent() {
  const { user, signOut, loading } = useAuth();
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>([]);

  const addWorkout = (workout: Workout) => {
    // Add to local state for immediate UI update
    setLocalWorkouts(prev => [workout, ...prev]);
    console.log('✅ Workout added to local state:', workout.type);
  };

  const handleWorkoutsUpdate = React.useCallback((workouts: Workout[]) => {
    // Update local workouts when backend data is fetched
    // This helps avoid duplicates and keeps everything in sync
    setLocalWorkouts([]);
    console.log('🔄 Workouts updated from backend:', workouts.length);
  }, []);

  if (loading) {
    return (
      <div className="App">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="App">
      <div className="user-menu">
        <span>{user.email}</span>
        <button onClick={signOut}>Sign Out</button>
      </div>
      <header className="App-header">
        <h1>Fitness Tracker</h1>
      </header>
      <main className="App-main">
        <PremiumFeatures />
        <WorkoutForm onAddWorkout={addWorkout} />
        <WorkoutList 
          workouts={localWorkouts} 
          onWorkoutsUpdate={handleWorkoutsUpdate}
        />
      </main>
    </div>
  );
}

function App() {
  const handleUserChange = (user: any) => {
    console.log('User changed:', user?.email || 'logged out');
  };

  return (
    <AuthProvider onUserChange={handleUserChange}>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
