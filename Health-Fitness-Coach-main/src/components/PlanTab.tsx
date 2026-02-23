const PLAN = [
    { day: 'Mon', focus: 'Chest & Triceps', status: 'Completed', color: 'var(--green)' },
    { day: 'Tue', focus: 'Back & Biceps', status: 'Pending', color: 'var(--primary)' },
    { day: 'Wed', focus: 'Recovery / Yoga', status: 'Pending', color: 'var(--text-muted)' },
    { day: 'Thu', focus: 'Legs & Shoulders', status: 'Pending', color: 'var(--primary)' },
    { day: 'Fri', focus: 'Cardio Blast', status: 'Pending', color: 'var(--primary)' },
    { day: 'Sat', focus: 'Full Body', status: 'Pending', color: 'var(--primary)' },
    { day: 'Sun', focus: 'Rest', status: 'Pending', color: 'var(--text-muted)' },
];

export function PlanTab() {
    return (
        <div className="tab-panel plan-panel">
            <div className="plan-header">
                <h3>This Week's Plan</h3>
                <button className="btn btn-sm btn-primary">Generate AI Plan</button>
            </div>
            <div className="plan-list">
                {PLAN.map(item => (
                    <div key={item.day} className="plan-item">
                        <div className="plan-day">{item.day}</div>
                        <div className="plan-focus">{item.focus}</div>
                        <div className="plan-status" style={{ color: item.color }}>{item.status}</div>
                    </div>
                ))}
            </div>
            <div className="plan-footer">
                <p>AI can generate a custom nutrition plan to match your workout schedule in the <strong>Nutrition</strong> tab.</p>
            </div>
        </div>
    );
}
