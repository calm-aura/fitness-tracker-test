import React from 'react';
import './App.css';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutList } from './components/WorkoutList';
import { Auth } from './components/Auth';
import { PremiumFeatures } from './components/PremiumFeatures';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Workout } from './types/workout';


function AppContent() {
  const { user, signOut, loading } = useAuth();

  const addWorkout = (workout: Workout) => {
    // Workout is saved to database in WorkoutForm, no local state needed
    // WorkoutList will automatically refresh and show the new workout
  };



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
        <WorkoutList workouts={[]} />
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
