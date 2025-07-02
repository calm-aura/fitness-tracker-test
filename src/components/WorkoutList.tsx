import React from 'react';
import { Workout } from '../types/workout';

interface WorkoutListProps {
    workouts: Workout[];
}

export const WorkoutList: React.FC<WorkoutListProps> = ({ workouts }) => {
    return (
        <div className="workout-list">
            <h2>Workout History</h2>
            {workouts.map((workout) => (
                <div key={workout.id} className="workout-card">
                    <h3>{new Date(workout.date).toLocaleDateString()}</h3>
                    <div className="exercises-list">
                        {workout.exercises.map((exercise) => (
                            <div key={exercise.id} className="exercise-item">
                                <strong>{exercise.name}</strong>
                                <p>
                                    {exercise.sets} sets × {exercise.reps} reps @ {exercise.weight} lbs
                                </p>
                            </div>
                        ))}
                    </div>
                    {workout.notes && (
                        <div className="workout-notes">
                            <p><em>Notes: {workout.notes}</em></p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}; 