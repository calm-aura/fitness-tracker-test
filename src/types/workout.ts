export interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: number;
    weight: number;
}

export interface Workout {
    id: string;
    date: string;
    exercises: Exercise[];
    notes?: string;
} 