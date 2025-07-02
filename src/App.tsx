import React, { useState } from 'react';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutList } from './components/WorkoutList';
import { Workout } from './types/workout';
import './App.css';

function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const handleWorkoutSubmit = (workout: Workout) => {
    setWorkouts([workout, ...workouts]);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Fitness Tracker</h1>
      </header>
      <main>
        <WorkoutForm onSubmit={handleWorkoutSubmit} />
        <WorkoutList workouts={workouts} />
      </main>
    </div>
  );
}

export default App; 