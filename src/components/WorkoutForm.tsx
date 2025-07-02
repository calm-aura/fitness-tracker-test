import React, { useState } from 'react';
import { Exercise, Workout } from '../types/workout';

interface WorkoutFormProps {
    onSubmit: (workout: Workout) => void;
}

export const WorkoutForm: React.FC<WorkoutFormProps> = ({ onSubmit }) => {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [notes, setNotes] = useState('');

    const addExercise = () => {
        const newExercise: Exercise = {
            id: Date.now().toString(),
            name: '',
            sets: 0,
            reps: 0,
            weight: 0
        };
        setExercises([...exercises, newExercise]);
    };

    const updateExercise = (index: number, field: keyof Exercise, value: string | number) => {
        const updatedExercises = exercises.map((exercise, i) => {
            if (i === index) {
                return { ...exercise, [field]: value };
            }
            return exercise;
        });
        setExercises(updatedExercises);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const workout: Workout = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            exercises,
            notes
        };
        onSubmit(workout);
        setExercises([]);
        setNotes('');
    };

    return (
        <form onSubmit={handleSubmit} className="workout-form">
            <h2>Log New Workout</h2>
            
            <div className="exercises">
                {exercises.map((exercise, index) => (
                    <div key={exercise.id} className="exercise-input">
                        <input
                            type="text"
                            placeholder="Exercise name"
                            value={exercise.name}
                            onChange={(e) => updateExercise(index, 'name', e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder="Sets"
                            value={exercise.sets}
                            onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value))}
                        />
                        <input
                            type="number"
                            placeholder="Reps"
                            value={exercise.reps}
                            onChange={(e) => updateExercise(index, 'reps', parseInt(e.target.value))}
                        />
                        <input
                            type="number"
                            placeholder="Weight (lbs)"
                            value={exercise.weight}
                            onChange={(e) => updateExercise(index, 'weight', parseInt(e.target.value))}
                        />
                    </div>
                ))}
            </div>
            
            <button type="button" onClick={addExercise}>
                Add Exercise
            </button>
            
            <textarea
                placeholder="Workout notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
            />
            
            <button type="submit" disabled={exercises.length === 0}>
                Save Workout
            </button>
        </form>
    );
}; 