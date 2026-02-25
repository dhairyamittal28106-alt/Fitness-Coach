import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * WorkoutsTab (Pro)
 * - Workout library + filters + search
 * - Workout detail drawer
 * - Start session mode (timer, sets, rest, step tracking)
 * - Weekly plan generator + saved plan
 * - LocalStorage persistence + history
 */

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type Category = "Strength" | "Cardio" | "Mobility" | "Core" | "HIIT";
type Equipment = "None" | "Dumbbells" | "Resistance Band" | "Gym";

type WorkoutStep = {
  id: string;
  title: string;
  type: "work" | "rest";
  durationSec?: number; // for HIIT / timed steps
  sets?: number; // for strength
  reps?: string; // e.g., "8-12"
  restSec?: number; // rest after a set
  notes?: string;
};

type Workout = {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  durationMin: number;
  equipment: Equipment;
  estCalories: number;
  description: string;
  tags: string[];
  steps: WorkoutStep[];
};

type SessionState = {
  activeWorkoutId: string;
  startedAt: number;
  paused: boolean;
  currentStepIndex: number;
  currentSet: number; // for strength steps
  remainingSec: number; // for timed steps
  notes: string;
};

type CompletedSession = {
  id: string;
  workoutId: string;
  workoutTitle: string;
  completedAt: number;
  totalSeconds: number;
  estCalories: number;
  notes: string;
};

type WeeklyPlan = {
  id: string;
  createdAt: number;
  days: Array<{
    day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    workoutId: string;
  }>;
};

const STORAGE_KEY = "fitnesscoach:workouts:v3";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function fmtTime(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const WORKOUTS: Workout[] = [
  {
    id: "hiit_full_body_20",
    title: "Full Body HIIT",
    category: "HIIT",
    difficulty: "Intermediate",
    durationMin: 20,
    equipment: "None",
    estCalories: 220,
    description: "A time-based HIIT session designed to improve conditioning and full-body work capacity.",
    tags: ["fat loss", "conditioning", "full body"],
    steps: [
      { id: "w1", title: "Warm-up (dynamic)", type: "work", durationSec: 180, notes: "Light movement, joint prep." },
      { id: "w2", title: "Jumping jacks", type: "work", durationSec: 40 },
      { id: "r2", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w3", title: "Bodyweight squats", type: "work", durationSec: 40 },
      { id: "r3", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w4", title: "Push-ups (modified if needed)", type: "work", durationSec: 40 },
      { id: "r4", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w5", title: "Mountain climbers", type: "work", durationSec: 40 },
      { id: "r5", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w6", title: "Plank hold", type: "work", durationSec: 40 },
      { id: "r6", title: "Rest", type: "rest", durationSec: 20 },
      { id: "w7", title: "Cool-down (breathing + stretch)", type: "work", durationSec: 180 },
    ],
  },
  {
    id: "upper_power_45",
    title: "Upper Body Power",
    category: "Strength",
    difficulty: "Intermediate",
    durationMin: 45,
    equipment: "Dumbbells",
    estCalories: 280,
    description: "Strength-focused upper body workout emphasizing progressive overload with controlled volume.",
    tags: ["strength", "upper body", "push/pull"],
    steps: [
      { id: "wu", title: "Warm-up (band + mobility)", type: "work", durationSec: 300 },
      { id: "s1", title: "Dumbbell bench press", type: "work", sets: 4, reps: "8-12", restSec: 75 },
      { id: "s2", title: "One-arm dumbbell row", type: "work", sets: 4, reps: "8-12/side", restSec: 75 },
      { id: "s3", title: "Overhead press", type: "work", sets: 3, reps: "8-10", restSec: 75 },
      { id: "s4", title: "Lateral raise", type: "work", sets: 3, reps: "12-15", restSec: 60 },
      { id: "s5", title: "Biceps curls", type: "work", sets: 3, reps: "10-12", restSec: 60 },
      { id: "s6", title: "Triceps extensions", type: "work", sets: 3, reps: "10-12", restSec: 60 },
      { id: "cd", title: "Cool-down (stretch)", type: "work", durationSec: 240 },
    ],
  },
  {
    id: "core_15",
    title: "Core Stability",
    category: "Core",
    difficulty: "Beginner",
    durationMin: 15,
    equipment: "None",
    estCalories: 90,
    description: "Core stability series focusing on anti-extension and controlled breathing.",
    tags: ["core", "stability", "posture"],
    steps: [
      { id: "w1", title: "Warm-up (cat-cow + breathing)", type: "work", durationSec: 120 },
      { id: "w2", title: "Dead bug", type: "work", sets: 3, reps: "8-10/side", restSec: 40 },
      { id: "w3", title: "Side plank", type: "work", sets: 2, reps: "20-30s/side", restSec: 45 },
      { id: "w4", title: "Glute bridge", type: "work", sets: 3, reps: "10-12", restSec: 45 },
      { id: "w5", title: "Bird dog", type: "work", sets: 2, reps: "8-10/side", restSec: 45 },
      { id: "cd", title: "Cool-down (stretch)", type: "work", durationSec: 120 },
    ],
  },
  {
    id: "yoga_30",
    title: "Mobility Flow",
    category: "Mobility",
    difficulty: "Beginner",
    durationMin: 30,
    equipment: "None",
    estCalories: 120,
    description: "Mobility-focused flow to reduce stiffness and improve range of motion.",
    tags: ["mobility", "recovery", "flexibility"],
    steps: [
      { id: "w1", title: "Neck + shoulder mobility", type: "work", durationSec: 240 },
      { id: "w2", title: "Hip opener flow", type: "work", durationSec: 420 },
      { id: "w3", title: "Thoracic rotations", type: "work", durationSec: 240 },
      { id: "w4", title: "Hamstring + calf stretch", type: "work", durationSec: 300 },
      { id: "w5", title: "Breathing (box breathing)", type: "work", durationSec: 180 },
    ],
  },
  {
    id: "leg_day_50",
    title: "Lower Body Strength",
    category: "Strength",
    difficulty: "Advanced",
    durationMin: 50,
    equipment: "Gym",
    estCalories: 360,
    description: "Lower-body session emphasizing strength and hypertrophy with structured rest and volume.",
    tags: ["legs", "strength", "hypertrophy"],
    steps: [
      { id: "wu", title: "Warm-up (bike + mobility)", type: "work", durationSec: 420 },
      { id: "s1", title: "Squat (barbell or goblet)", type: "work", sets: 5, reps: "5-8", restSec: 120 },
      { id: "s2", title: "Romanian deadlift", type: "work", sets: 4, reps: "8-10", restSec: 120 },
      { id: "s3", title: "Split squat", type: "work", sets: 3, reps: "8-10/side", restSec: 90 },
      { id: "s4", title: "Leg curl", type: "work", sets: 3, reps: "10-12", restSec: 75 },
      { id: "s5", title: "Calf raise", type: "work", sets: 4, reps: "12-15", restSec: 60 },
      { id: "cd", title: "Cool-down (stretch)", type: "work", durationSec: 240 },
    ],
  },
  {
    id: "cardio_zone2_30",
    title: "Zone 2 Cardio",
    category: "Cardio",
    difficulty: "Beginner",
    durationMin: 30,
    equipment: "None",
    estCalories: 180,
    description: "Low-to-moderate steady-state cardio for endurance and recovery.",
    tags: ["cardio", "endurance", "recovery"],
    steps: [
      { id: "w1", title: "Warm-up walk", type: "work", durationSec: 300 },
      { id: "w2", title: "Steady pace (talk test)", type: "work", durationSec: 1200 },
      { id: "w3", title: "Cool-down walk", type: "work", durationSec: 300 },
    ],
  },
];

type Persisted = {
  history: CompletedSession[];
  weeklyPlan: WeeklyPlan | null;
  session: SessionState | null;
};

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no");
    const parsed = JSON.parse(raw) as Persisted;
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      weeklyPlan: parsed.weeklyPlan ?? null,
      session: parsed.session ?? null,
    };
  } catch {
    return { history: [], weeklyPlan: null, session: null };
  }
}
function savePersisted(p: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function WorkoutsTab() {
  const [persisted, setPersisted] = useState<Persisted>(() => loadPersisted());

  // filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [equipment, setEquipment] = useState<Equipment | "All">("All");
  const [maxDuration, setMaxDuration] = useState<number>(60);

  // UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<"library" | "plan" | "history">("library");

  // live session
  const [session, setSession] = useState<SessionState | null>(() => persisted.session);
  const tickRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // persist
  useEffect(() => {
    savePersisted({ ...persisted, session });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted, session]);

  const selectedWorkout = useMemo(() => {
    const id = selectedId ?? session?.activeWorkoutId ?? null;
    if (!id) return null;
    return WORKOUTS.find((w) => w.id === id) || null;
  }, [selectedId, session?.activeWorkoutId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return WORKOUTS.filter((w) => {
      if (category !== "All" && w.category !== category) return false;
      if (difficulty !== "All" && w.difficulty !== difficulty) return false;
      if (equipment !== "All" && w.equipment !== equipment) return false;
      if (w.durationMin > maxDuration) return false;

      if (!q) return true;
      const hay = `${w.title} ${w.description} ${w.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [search, category, difficulty, equipment, maxDuration]);

  function openDrawer(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function generateWeeklyPlan() {
    // balanced plan: Strength x2, Cardio x2, Mobility x1, Core x1, Optional HIIT x1
    const pick = (id: string) => id;

    const days: WeeklyPlan["days"] = [
      { day: "Mon", workoutId: pick("upper_power_45") },
      { day: "Tue", workoutId: pick("cardio_zone2_30") },
      { day: "Wed", workoutId: pick("core_15") },
      { day: "Thu", workoutId: pick("yoga_30") },
      { day: "Fri", workoutId: pick("leg_day_50") },
      { day: "Sat", workoutId: pick("hiit_full_body_20") },
      { day: "Sun", workoutId: pick("cardio_zone2_30") },
    ];

    setPersisted((p) => ({
      ...p,
      weeklyPlan: { id: uid("plan"), createdAt: Date.now(), days },
    }));
    setTab("plan");
  }

  function clearPlan() {
    setPersisted((p) => ({ ...p, weeklyPlan: null }));
  }

  function startWorkout(workoutId: string) {
    const w = WORKOUTS.find((x) => x.id === workoutId);
    if (!w) return;

    // start on first step; set defaults
    const first = w.steps[0];
    const remainingSec = first.durationSec ?? (first.restSec ?? 0);

    const s: SessionState = {
      activeWorkoutId: workoutId,
      startedAt: Date.now(),
      paused: false,
      currentStepIndex: 0,
      currentSet: 1,
      remainingSec: remainingSec || 0,
      notes: "",
    };

    setSession(s);
    setSelectedId(workoutId);
    setDrawerOpen(false);
    setTab("library");
  }

  function stopTimer() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  function ensureTimer() {
    if (tickRef.current) return;
    lastTickRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.paused) return prev;

        const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
        if (!w) return prev;

        const now = Date.now();
        const deltaSec = Math.max(0, Math.floor((now - lastTickRef.current) / 1000));
        if (deltaSec <= 0) return prev;
        lastTickRef.current = now;

        const currentStep = w.steps[prev.currentStepIndex];
        if (!currentStep) return prev;

        // only tick down for timed steps (work/rest)
        const isTimed = typeof currentStep.durationSec === "number";
        if (!isTimed) return prev;

        const nextRemain = prev.remainingSec - deltaSec;
        if (nextRemain > 0) {
          return { ...prev, remainingSec: nextRemain };
        }

        // time finished -> auto advance
        return advanceStep(prev, w, true);
      });
    }, 250);
  }

  useEffect(() => {
    if (session && !session.paused) ensureTimer();
    else stopTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.paused, session?.activeWorkoutId]);

  function currentWorkoutAndStep() {
    if (!session) return { w: null as Workout | null, step: null as WorkoutStep | null };
    const w = WORKOUTS.find((x) => x.id === session.activeWorkoutId) || null;
    const step = w?.steps?.[session.currentStepIndex] ?? null;
    return { w, step };
  }

  function setPaused(paused: boolean) {
    setSession((s) => (s ? { ...s, paused } : s));
  }

  function advanceStep(prev: SessionState, w: Workout, fromTimer = false): SessionState {
    const step = w.steps[prev.currentStepIndex];
    if (!step) return prev;

    // If strength step has sets, move set counter, else move next step
    if (step.sets && step.sets > 0) {
      // after each set, you rest (restSec) if provided, but we keep it simple:
      // manual "Complete Set" will manage set increments; timer auto-advance only for timed steps.
      if (fromTimer) {
        // timed steps shouldn't come here for strength
        return prev;
      }
    }

    const nextIndex = clamp(prev.currentStepIndex + 1, 0, w.steps.length);
    if (nextIndex >= w.steps.length) {
      // workout finished
      finishSession(prev, w);
      return prev; // session cleared in finishSession
    }

    const nextStep = w.steps[nextIndex];
    const remainingSec = nextStep.durationSec ?? 0;

    return {
      ...prev,
      currentStepIndex: nextIndex,
      currentSet: 1,
      remainingSec,
    };
  }

  function prevStep() {
    setSession((prev) => {
      if (!prev) return prev;
      const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
      if (!w) return prev;
      const nextIndex = clamp(prev.currentStepIndex - 1, 0, w.steps.length - 1);
      const step = w.steps[nextIndex];
      return {
        ...prev,
        currentStepIndex: nextIndex,
        currentSet: 1,
        remainingSec: step.durationSec ?? 0,
      };
    });
  }

  function nextStep() {
    setSession((prev) => {
      if (!prev) return prev;
      const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
      if (!w) return prev;
      return advanceStep(prev, w, false);
    });
  }

  function completeSet() {
    setSession((prev) => {
      if (!prev) return prev;
      const w = WORKOUTS.find((x) => x.id === prev.activeWorkoutId);
      if (!w) return prev;

      const step = w.steps[prev.currentStepIndex];
      if (!step?.sets) return prev;

      if (prev.currentSet < step.sets) {
        return { ...prev, currentSet: prev.currentSet + 1 };
      }

      // sets completed -> move next
      return advanceStep(prev, w, false);
    });
  }

  function finishSession(s: SessionState, w: Workout) {
    const totalSeconds = Math.max(1, Math.floor((Date.now() - s.startedAt) / 1000));
    const completed: CompletedSession = {
      id: uid("session"),
      workoutId: w.id,
      workoutTitle: w.title,
      completedAt: Date.now(),
      totalSeconds,
      estCalories: w.estCalories,
      notes: s.notes?.trim() || "",
    };
    setPersisted((p) => ({ ...p, history: [completed, ...p.history].slice(0, 60) }));
    setSession(null);
  }

  function abandonSession() {
    setSession(null);
  }

  function removeHistoryItem(id: string) {
    setPersisted((p) => ({ ...p, history: p.history.filter((x) => x.id !== id) }));
  }

  const sessionView = useMemo(() => {
    if (!session) return null;
    const { w, step } = currentWorkoutAndStep();
    if (!w || !step) return null;

    const progressPct = Math.round(((session.currentStepIndex + 1) / w.steps.length) * 100);
    const isTimed = typeof step.durationSec === "number";
    const isStrength = typeof step.sets === "number" && !!step.reps;

    return {
      w,
      step,
      progressPct,
      isTimed,
      isStrength,
    };
  }, [session]);

  return (
    <div className="wk-wrap">
      <div className="wk-head">
        <div>
          <div className="wk-badge">Workouts</div>
          <h2>Workout Library and Training Plan</h2>
          <p className="wk-muted">
            Use the library to start a session, follow the weekly plan, and track your history.
          </p>
        </div>

        <div className="wk-tabs">
          <button className={`wk-tab ${tab === "library" ? "active" : ""}`} onClick={() => setTab("library")}>
            Library
          </button>
          <button className={`wk-tab ${tab === "plan" ? "active" : ""}`} onClick={() => setTab("plan")}>
            Weekly plan
          </button>
          <button className={`wk-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            History
          </button>
        </div>
      </div>

      {/* Active session banner */}
      {sessionView && (
        <div className="wk-session card">
          <div className="wk-session-left">
            <div className="wk-session-title">{sessionView.w.title}</div>
            <div className="wk-muted mini">
              Step {session!.currentStepIndex + 1} of {sessionView.w.steps.length} • {sessionView.progressPct}% complete
            </div>
            <div className="wk-progress">
              <div className="wk-progress-fill" style={{ width: `${sessionView.progressPct}%` }} />
            </div>
          </div>

          <div className="wk-session-actions">
            <button className="wk-btn ghost" onClick={() => setPaused(!session!.paused)}>
              {session!.paused ? "Resume" : "Pause"}
            </button>
            <button className="wk-btn danger ghost" onClick={abandonSession}>
              End session
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      {tab === "library" && (
        <div className="wk-grid">
          {/* Filters */}
          <div className="card wk-filters">
            <div className="wk-panel-head">
              <h3>Filters</h3>
              <span className="wk-pill">Refine results</span>
            </div>

            <label className="wk-field">
              <span>Search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, tags, description..." />
            </label>

            <div className="wk-two">
              <label className="wk-field">
                <span>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as any)}>
                  <option value="All">All</option>
                  <option value="Strength">Strength</option>
                  <option value="Cardio">Cardio</option>
                  <option value="Mobility">Mobility</option>
                  <option value="Core">Core</option>
                  <option value="HIIT">HIIT</option>
                </select>
              </label>

              <label className="wk-field">
                <span>Difficulty</span>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                  <option value="All">All</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </label>

              <label className="wk-field">
                <span>Equipment</span>
                <select value={equipment} onChange={(e) => setEquipment(e.target.value as any)}>
                  <option value="All">All</option>
                  <option value="None">None</option>
                  <option value="Dumbbells">Dumbbells</option>
                  <option value="Resistance Band">Resistance band</option>
                  <option value="Gym">Gym</option>
                </select>
              </label>

              <label className="wk-field">
                <span>Max duration (minutes)</span>
                <input
                  type="number"
                  min={10}
                  max={90}
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(clamp(Number(e.target.value) || 60, 10, 90))}
                />
              </label>
            </div>

            <div className="wk-actions">
              <button className="wk-btn primary" onClick={generateWeeklyPlan}>Generate weekly plan</button>
              <button className="wk-btn ghost" onClick={() => {
                setSearch("");
                setCategory("All");
                setDifficulty("All");
                setEquipment("All");
                setMaxDuration(60);
              }}>
                Reset
              </button>
            </div>
          </div>

          {/* List */}
          <div className="card wk-list">
            <div className="wk-panel-head">
              <h3>Workout library</h3>
              <span className="wk-muted mini">{filtered.length} results</span>
            </div>

            <div className="wk-cards">
              {filtered.map((w) => (
                <button key={w.id} className="wk-card" onClick={() => openDrawer(w.id)} type="button">
                  <div className="wk-card-top">
                    <div className="wk-card-title">{w.title}</div>
                    <div className="wk-pill subtle">{w.category}</div>
                  </div>

                  <div className="wk-muted mini">{w.description}</div>

                  <div className="wk-meta">
                    <span className="wk-chip">{w.durationMin} min</span>
                    <span className="wk-chip">{w.difficulty}</span>
                    <span className="wk-chip">{w.equipment}</span>
                    <span className="wk-chip">{w.estCalories} kcal</span>
                  </div>

                  <div className="wk-tags">
                    {w.tags.slice(0, 3).map((t) => (
                      <span key={t} className="wk-tag">{t}</span>
                    ))}
                  </div>
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="wk-empty">
                  No workouts match your filters. Adjust the filters or reset.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "plan" && (
        <div className="wk-plan">
          <div className="card">
            <div className="wk-panel-head">
              <h3>Weekly plan</h3>
              <div className="wk-row">
                <button className="wk-btn primary" onClick={generateWeeklyPlan}>Regenerate</button>
                <button className="wk-btn danger ghost" onClick={clearPlan} disabled={!persisted.weeklyPlan}>
                  Clear
                </button>
              </div>
            </div>

            {!persisted.weeklyPlan ? (
              <div className="wk-empty">
                No plan saved yet. Generate a weekly plan from the Library tab.
              </div>
            ) : (
              <div className="wk-plan-grid">
                {persisted.weeklyPlan.days.map((d) => {
                  const w = WORKOUTS.find((x) => x.id === d.workoutId);
                  return (
                    <div key={d.day} className="wk-plan-day">
                      <div className="wk-plan-day-top">
                        <div className="wk-plan-day-name">{d.day}</div>
                        <span className="wk-pill subtle">{w?.category ?? "Workout"}</span>
                      </div>
                      <div className="wk-plan-title">{w?.title ?? "Unknown workout"}</div>
                      <div className="wk-muted mini">
                        {w?.durationMin ?? "-"} min • {w?.difficulty ?? "-"} • {w?.equipment ?? "-"}
                      </div>
                      <div className="wk-row" style={{ marginTop: 10 }}>
                        <button className="wk-btn ghost" onClick={() => openDrawer(d.workoutId)}>View</button>
                        <button className="wk-btn primary" onClick={() => startWorkout(d.workoutId)}>Start</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {persisted.weeklyPlan && (
              <div className="wk-muted mini" style={{ marginTop: 10 }}>
                Created: {fmtDate(persisted.weeklyPlan.createdAt)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="wk-history">
          <div className="card">
            <div className="wk-panel-head">
              <h3>Workout history</h3>
              <span className="wk-muted mini">{persisted.history.length} sessions</span>
            </div>

            {persisted.history.length === 0 ? (
              <div className="wk-empty">
                No completed sessions yet. Start a workout from the library.
              </div>
            ) : (
              <div className="wk-history-list">
                {persisted.history.map((h) => (
                  <div key={h.id} className="wk-history-item">
                    <div>
                      <div className="wk-history-title">{h.workoutTitle}</div>
                      <div className="wk-muted mini">
                        {fmtDate(h.completedAt)} • {fmtTime(h.totalSeconds)} • {h.estCalories} kcal
                      </div>
                      {h.notes && <div className="wk-note">{h.notes}</div>}
                    </div>
                    <div className="wk-row">
                      <button className="wk-btn ghost" onClick={() => openDrawer(h.workoutId)}>View workout</button>
                      <button className="wk-btn danger ghost" onClick={() => removeHistoryItem(h.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && selectedWorkout && (
        <div className="wk-modal" role="dialog" aria-modal="true">
          <div className="wk-drawer card">
            <div className="wk-drawer-head">
              <div>
                <div className="wk-drawer-title">{selectedWorkout.title}</div>
                <div className="wk-muted mini">
                  {selectedWorkout.category} • {selectedWorkout.difficulty} • {selectedWorkout.durationMin} min • {selectedWorkout.equipment}
                </div>
              </div>

              <button className="wk-icon" onClick={closeDrawer} title="Close">
                ×
              </button>
            </div>

            <p className="wk-muted">{selectedWorkout.description}</p>

            <div className="wk-meta">
              <span className="wk-chip">{selectedWorkout.estCalories} kcal estimated</span>
              <span className="wk-chip">{selectedWorkout.steps.length} steps</span>
              {selectedWorkout.tags.slice(0, 4).map((t) => (
                <span key={t} className="wk-chip">{t}</span>
              ))}
            </div>

            <div className="wk-steps">
              <div className="wk-panel-head">
                <h3>Workout plan</h3>
                <span className="wk-pill subtle">Structure</span>
              </div>

              {selectedWorkout.steps.map((s, idx) => (
                <div key={s.id} className="wk-step">
                  <div className="wk-step-left">
                    <div className="wk-step-idx">{idx + 1}</div>
                    <div>
                      <div className="wk-step-title">{s.title}</div>
                      <div className="wk-muted mini">
                        {s.type === "rest" ? "Rest" : "Work"}
                        {typeof s.durationSec === "number" && ` • ${fmtTime(s.durationSec)}`}
                        {s.sets && ` • ${s.sets} sets`}
                        {s.reps && ` • ${s.reps}`}
                        {s.restSec && ` • rest ${fmtTime(s.restSec)}`}
                      </div>
                      {s.notes && <div className="wk-muted mini" style={{ marginTop: 4 }}>{s.notes}</div>}
                    </div>
                  </div>
                  <div className={`wk-step-pill ${s.type === "rest" ? "rest" : "work"}`}>{s.type.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <div className="wk-drawer-actions">
              <button className="wk-btn ghost" onClick={() => startWorkout(selectedWorkout.id)}>Start session</button>
              <button className="wk-btn primary" onClick={() => { startWorkout(selectedWorkout.id); }}>
                Start now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session full-screen panel */}
      {sessionView && (
        <div className="wk-modal" role="dialog" aria-modal="true">
          <div className="wk-session-screen card">
            <div className="wk-session-screen-head">
              <div>
                <div className="wk-session-title">{sessionView.w.title}</div>
                <div className="wk-muted mini">
                  {sessionView.w.category} • {sessionView.w.difficulty} • {sessionView.w.equipment}
                </div>
              </div>
              <button className="wk-icon" onClick={abandonSession} title="End session">×</button>
            </div>

            <div className="wk-session-body">
              <div className="wk-session-step">
                <div className="wk-pill subtle">
                  Step {session!.currentStepIndex + 1} of {sessionView.w.steps.length}
                </div>

                <h3 style={{ marginTop: 10 }}>{sessionView.step.title}</h3>

                <div className="wk-session-meta">
                  {sessionView.isTimed && (
                    <div className="wk-timer">
                      <div className="wk-timer-label">Timer</div>
                      <div className="wk-timer-value">{fmtTime(session!.remainingSec || sessionView.step.durationSec || 0)}</div>
                    </div>
                  )}

                  {sessionView.isStrength && (
                    <div className="wk-timer">
                      <div className="wk-timer-label">Sets</div>
                      <div className="wk-timer-value">
                        {session!.currentSet} / {sessionView.step.sets}
                      </div>
                      <div className="wk-muted mini">Reps: {sessionView.step.reps}</div>
                      {sessionView.step.restSec && <div className="wk-muted mini">Rest: {fmtTime(sessionView.step.restSec)}</div>}
                    </div>
                  )}

                  <div className="wk-timer">
                    <div className="wk-timer-label">Step type</div>
                    <div className="wk-timer-value">{sessionView.step.type.toUpperCase()}</div>
                  </div>
                </div>

                {sessionView.step.notes && (
                  <div className="wk-note" style={{ marginTop: 10 }}>
                    {sessionView.step.notes}
                  </div>
                )}
              </div>

              <div className="wk-session-controls">
                <div className="wk-row">
                  <button className="wk-btn ghost" onClick={prevStep}>Previous</button>
                  <button className="wk-btn ghost" onClick={() => setPaused(!session!.paused)}>
                    {session!.paused ? "Resume" : "Pause"}
                  </button>
                  <button className="wk-btn ghost" onClick={nextStep}>Next</button>
                </div>

                {sessionView.isStrength ? (
                  <button className="wk-btn primary" onClick={completeSet}>
                    Complete set
                  </button>
                ) : (
                  <button className="wk-btn primary" onClick={nextStep}>
                    Mark step complete
                  </button>
                )}

                <label className="wk-field" style={{ marginTop: 10 }}>
                  <span>Session notes</span>
                  <textarea
                    value={session!.notes}
                    onChange={(e) => setSession((s) => (s ? { ...s, notes: e.target.value } : s))}
                    placeholder="Optional notes (effort, pain, adjustments)..."
                    rows={3}
                  />
                </label>

                <div className="wk-row" style={{ marginTop: 10 }}>
                  <button
                    className="wk-btn danger ghost"
                    onClick={() => {
                      const w = sessionView.w;
                      const s = session!;
                      // finalize immediately
                      const totalSeconds = Math.max(1, Math.floor((Date.now() - s.startedAt) / 1000));
                      const completed: CompletedSession = {
                        id: uid("session"),
                        workoutId: w.id,
                        workoutTitle: w.title,
                        completedAt: Date.now(),
                        totalSeconds,
                        estCalories: w.estCalories,
                        notes: s.notes?.trim() || "",
                      };
                      setPersisted((p) => ({ ...p, history: [completed, ...p.history].slice(0, 60) }));
                      setSession(null);
                    }}
                  >
                    Finish workout
                  </button>

                  <button className="wk-btn ghost" onClick={abandonSession}>
                    Exit without saving
                  </button>
                </div>
              </div>
            </div>

            <div className="wk-muted mini" style={{ marginTop: 10 }}>
              Timer steps auto-advance when time reaches zero. Strength steps use the set counter.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}