const WORKOUTS = [
    { id: 1, title: 'Full Body HIIT', duration: '20 min', intensity: 'High', emoji: '🔥' },
    { id: 2, title: 'Upper Body Power', duration: '45 min', intensity: 'Medium', emoji: '💪' },
    { id: 3, title: 'Core Crusher', duration: '15 min', intensity: 'High', emoji: '⚡' },
    { id: 4, title: 'Yoga Flow', duration: '30 min', intensity: 'Low', emoji: '🧘' },
    { id: 5, title: 'Leg Day', duration: '50 min', intensity: 'High', emoji: '🦵' },
];

export function WorkoutsTab() {
    return (
        <div className="tab-panel workouts-panel">
            <div className="workout-grid">
                {WORKOUTS.map(workout => (
                    <div key={workout.id} className="workout-card">
                        <div className="workout-emoji">{workout.emoji}</div>
                        <div className="workout-info">
                            <h4>{workout.title}</h4>
                            <div className="workout-meta">
                                <span>{workout.duration}</span>
                                <span className={`intensity-${workout.intensity.toLowerCase()}`}>{workout.intensity}</span>
                            </div>
                        </div>
                        <button className="btn btn-sm">Start</button>
                    </div>
                ))}
            </div>
            <div className="ai-suggestion">
                <p>💡 Ask <strong>Coach AI</strong> for a personalized workout routine based on your goals!</p>
            </div>
        </div>
    );
}
