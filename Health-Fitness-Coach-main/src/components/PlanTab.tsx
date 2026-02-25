import React, { useEffect, useMemo, useState } from "react";

type BillingCycle = "Weekly" | "Monthly" | "Yearly";
type PlanTier = "Basic" | "Pro" | "Elite";

type Subscription = {
  tier: PlanTier;
  cycle: BillingCycle;
  price: number;
  currency: "INR";
  active: boolean;
  startedAt?: number;
  renewsAt?: number;
};

type Coach = {
  id: string;
  name: string;
  title: string;
  specialty: "Strength" | "Weight loss" | "Mobility" | "Rehab" | "Sports";
  rating: number;
  reviews: number;
  years: number;
  language: string[];
  pricePerMonth: number;
  availability: "Accepting clients" | "Limited slots";
  bio: string;
  highlights: string[];
};

type PlanDay = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  focus: string;
  status: "Completed" | "Pending" | "Rest";
};

type PaymentMethod = "UPI" | "Card" | "NetBanking";

type Persisted = {
  subscription: Subscription | null;
  bookedCoachId: string | null;
  weeklyPlan: PlanDay[];
  lastUpdatedAt: number;
};

const STORAGE_KEY = "fitnesscoach:plan:v2";

const DEFAULT_PLAN: PlanDay[] = [
  { day: "Mon", focus: "Chest & Triceps", status: "Pending" },
  { day: "Tue", focus: "Back & Biceps", status: "Pending" },
  { day: "Wed", focus: "Recovery / Mobility", status: "Rest" },
  { day: "Thu", focus: "Legs & Shoulders", status: "Pending" },
  { day: "Fri", focus: "Cardio (Zone 2)", status: "Pending" },
  { day: "Sat", focus: "Full Body (Strength)", status: "Pending" },
  { day: "Sun", focus: "Rest", status: "Rest" },
];

const COACHES: Coach[] = [
  {
    id: "c1",
    name: "Aarav Mehta",
    title: "Strength and Conditioning Coach",
    specialty: "Strength",
    rating: 4.8,
    reviews: 268,
    years: 7,
    language: ["English", "Hindi"],
    pricePerMonth: 1499,
    availability: "Accepting clients",
    bio: "Structured strength plans with measurable progression. Focus on technique, recovery, and sustainable habits.",
    highlights: ["Form correction reviews", "Progressive overload programming", "Weekly check-ins"],
  },
  {
    id: "c2",
    name: "Riya Sharma",
    title: "Weight Loss and Nutrition Coach",
    specialty: "Weight loss",
    rating: 4.7,
    reviews: 412,
    years: 6,
    language: ["English", "Hindi"],
    pricePerMonth: 1299,
    availability: "Limited slots",
    bio: "Calorie-aware planning with practical guidance. Designed for consistency, not extremes.",
    highlights: ["Meal planning framework", "Weekly progress reviews", "Habit-based coaching"],
  },
  {
    id: "c3",
    name: "Kabir Singh",
    title: "Mobility and Movement Specialist",
    specialty: "Mobility",
    rating: 4.9,
    reviews: 188,
    years: 8,
    language: ["English"],
    pricePerMonth: 1799,
    availability: "Accepting clients",
    bio: "Mobility-first approach to reduce stiffness and improve movement quality for training and daily life.",
    highlights: ["Mobility assessment", "Recovery plan", "Technique refinement"],
  },
  {
    id: "c4",
    name: "Naina Verma",
    title: "Rehab and Corrective Exercise Coach",
    specialty: "Rehab",
    rating: 4.8,
    reviews: 154,
    years: 9,
    language: ["English", "Hindi"],
    pricePerMonth: 1999,
    availability: "Limited slots",
    bio: "Corrective routines and safe return-to-training progression. Prioritizes form and pain-free movement.",
    highlights: ["Injury-safe progressions", "Form audits", "Personalized recovery plan"],
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no");
    const parsed = JSON.parse(raw) as Persisted;
    return {
      subscription: parsed.subscription ?? null,
      bookedCoachId: parsed.bookedCoachId ?? null,
      weeklyPlan: Array.isArray(parsed.weeklyPlan) && parsed.weeklyPlan.length ? parsed.weeklyPlan : DEFAULT_PLAN,
      lastUpdatedAt: parsed.lastUpdatedAt ?? Date.now(),
    };
  } catch {
    return {
      subscription: null,
      bookedCoachId: null,
      weeklyPlan: DEFAULT_PLAN,
      lastUpdatedAt: Date.now(),
    };
  }
}
function savePersisted(p: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const SUBSCRIPTIONS: Array<{
  tier: PlanTier;
  label: string;
  description: string;
  features: string[];
  weekly: number;
  monthly: number;
  yearly: number;
  popular?: boolean;
}> = [
  {
    tier: "Basic",
    label: "Basic",
    description: "Plan, track, and build consistency.",
    features: ["Weekly plan builder", "Workout and session tracking", "Basic progress insights"],
    weekly: 99,
    monthly: 249,
    yearly: 1999,
  },
  {
    tier: "Pro",
    label: "Pro",
    description: "Best for serious routine and coaching workflows.",
    features: ["Everything in Basic", "Advanced workout templates", "Priority support", "Plan adherence insights"],
    weekly: 149,
    monthly: 399,
    yearly: 2999,
    popular: true,
  },
  {
    tier: "Elite",
    label: "Elite",
    description: "For high-intent users with premium guidance.",
    features: ["Everything in Pro", "Coach hiring access", "Monthly plan reviews", "Form review queue"],
    weekly: 199,
    monthly: 599,
    yearly: 4499,
  },
];

export function PlanTab() {
  const [persisted, setPersisted] = useState<Persisted>(() => loadPersisted());

  const [view, setView] = useState<"overview" | "subscriptions" | "coaches" | "builder">("overview");

  // subscription selection
  const [cycle, setCycle] = useState<BillingCycle>("Monthly");
  const [selectedTier, setSelectedTier] = useState<PlanTier>("Pro");

  // coach search/filter
  const [coachQuery, setCoachQuery] = useState("");
  const [coachSpecialty, setCoachSpecialty] = useState<Coach["specialty"] | "All">("All");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);

  // checkout modal
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"subscription" | "coach">("subscription");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

  // plan builder
  const [planDraft, setPlanDraft] = useState<PlanDay[]>(() => persisted.weeklyPlan);

  useEffect(() => {
    savePersisted(persisted);
  }, [persisted]);

  useEffect(() => {
    setPlanDraft(persisted.weeklyPlan);
  }, [persisted.weeklyPlan]);

  const bookedCoach = useMemo(() => {
    if (!persisted.bookedCoachId) return null;
    return COACHES.find((c) => c.id === persisted.bookedCoachId) || null;
  }, [persisted.bookedCoachId]);

  const selectedCoach = useMemo(() => {
    if (!selectedCoachId) return null;
    return COACHES.find((c) => c.id === selectedCoachId) || null;
  }, [selectedCoachId]);

  const adherence = useMemo(() => {
    const total = persisted.weeklyPlan.length;
    const completed = persisted.weeklyPlan.filter((d) => d.status === "Completed").length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [persisted.weeklyPlan]);

  const tierMeta = useMemo(() => SUBSCRIPTIONS.find((s) => s.tier === selectedTier)!, [selectedTier]);

  const priceForSelection = useMemo(() => {
    const p =
      cycle === "Weekly" ? tierMeta.weekly : cycle === "Monthly" ? tierMeta.monthly : tierMeta.yearly;
    return p;
  }, [cycle, tierMeta]);

  const filteredCoaches = useMemo(() => {
    const q = coachQuery.trim().toLowerCase();
    return COACHES.filter((c) => {
      if (coachSpecialty !== "All" && c.specialty !== coachSpecialty) return false;
      if (!q) return true;
      const hay = `${c.name} ${c.title} ${c.specialty} ${c.bio} ${c.highlights.join(" ")}`.toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => b.rating - a.rating);
  }, [coachQuery, coachSpecialty]);

  function openSubscriptionCheckout() {
    setCheckoutMode("subscription");
    setCheckoutOpen(true);
  }
  function openCoachCheckout(coachId: string) {
    setSelectedCoachId(coachId);
    setCheckoutMode("coach");
    setCheckoutOpen(true);
  }
  function closeCheckout() {
    setCheckoutOpen(false);
  }

  function activateSubscription() {
    // UI-only mock activation
    const now = Date.now();
    const renewMs =
      cycle === "Weekly" ? 7 * 24 * 3600 * 1000 : cycle === "Monthly" ? 30 * 24 * 3600 * 1000 : 365 * 24 * 3600 * 1000;

    const sub: Subscription = {
      tier: selectedTier,
      cycle,
      price: priceForSelection,
      currency: "INR",
      active: true,
      startedAt: now,
      renewsAt: now + renewMs,
    };

    setPersisted((p) => ({
      ...p,
      subscription: sub,
      lastUpdatedAt: Date.now(),
    }));

    setCheckoutOpen(false);
    setView("overview");
  }

  function bookCoach() {
    if (!selectedCoachId) return;
    // UI-only mock booking; should be gated behind Elite tier in production
    setPersisted((p) => ({
      ...p,
      bookedCoachId: selectedCoachId,
      lastUpdatedAt: Date.now(),
    }));
    setCheckoutOpen(false);
    setView("overview");
  }

  function cancelSubscription() {
    setPersisted((p) => ({
      ...p,
      subscription: null,
      lastUpdatedAt: Date.now(),
    }));
  }

  function unbookCoach() {
    setPersisted((p) => ({
      ...p,
      bookedCoachId: null,
      lastUpdatedAt: Date.now(),
    }));
  }

  function markDay(day: PlanDay["day"], status: PlanDay["status"]) {
    setPersisted((p) => ({
      ...p,
      weeklyPlan: p.weeklyPlan.map((d) => (d.day === day ? { ...d, status } : d)),
      lastUpdatedAt: Date.now(),
    }));
  }

  function updateDraft(day: PlanDay["day"], focus: string, status: PlanDay["status"]) {
    setPlanDraft((prev) => prev.map((d) => (d.day === day ? { ...d, focus, status } : d)));
  }

  function saveDraft() {
    setPersisted((p) => ({
      ...p,
      weeklyPlan: planDraft,
      lastUpdatedAt: Date.now(),
    }));
    setView("overview");
  }

  function resetDraft() {
    setPlanDraft(DEFAULT_PLAN);
  }

  const hasElite = persisted.subscription?.active && persisted.subscription?.tier === "Elite";

  return (
    <div className="pl-wrap">
      <div className="pl-head">
        <div>
          <div className="pl-badge">Plan</div>
          <h2>Planning, Subscriptions, and Coach Hiring</h2>
          <p className="pl-muted">
            Manage your weekly schedule, upgrade your plan, and hire a coach for structured guidance.
          </p>
        </div>

        <div className="pl-tabs">
          <button className={`pl-tab ${view === "overview" ? "active" : ""}`} onClick={() => setView("overview")}>
            Overview
          </button>
          <button className={`pl-tab ${view === "builder" ? "active" : ""}`} onClick={() => setView("builder")}>
            Plan builder
          </button>
          <button className={`pl-tab ${view === "subscriptions" ? "active" : ""}`} onClick={() => setView("subscriptions")}>
            Subscriptions
          </button>
          <button className={`pl-tab ${view === "coaches" ? "active" : ""}`} onClick={() => setView("coaches")}>
            Coaches
          </button>
        </div>
      </div>

      {/* Overview */}
      {view === "overview" && (
        <div className="pl-grid">
          <div className="card">
            <div className="pl-panel-head">
              <h3>This week</h3>
              <span className="pl-pill">{adherence.pct}% adherence</span>
            </div>

            <div className="pl-progress">
              <div className="pl-progress-fill" style={{ width: `${adherence.pct}%` }} />
            </div>

            <div className="pl-week">
              {persisted.weeklyPlan.map((d) => (
                <div key={d.day} className="pl-row">
                  <div className="pl-day">{d.day}</div>
                  <div className="pl-focus">{d.focus}</div>
                  <div className={`pl-status ${d.status === "Completed" ? "ok" : d.status === "Rest" ? "muted" : "pending"}`}>
                    {d.status}
                  </div>
                  <div className="pl-actions">
                    <button className="pl-btn ghost" onClick={() => markDay(d.day, "Pending")} disabled={d.status === "Rest"}>
                      Pending
                    </button>
                    <button className="pl-btn ghost" onClick={() => markDay(d.day, "Completed")} disabled={d.status === "Rest"}>
                      Completed
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pl-muted mini" style={{ marginTop: 10 }}>
              Last updated: {fmtDate(persisted.lastUpdatedAt)}
            </div>
          </div>

          <div className="pl-side">
            <div className="card">
              <div className="pl-panel-head">
                <h3>Subscription</h3>
                <span className="pl-pill subtle">{persisted.subscription?.active ? "Active" : "Inactive"}</span>
              </div>

              {!persisted.subscription?.active ? (
                <>
                  <div className="pl-muted" style={{ marginTop: 10 }}>
                    Upgrade to unlock advanced planning features and coach workflows.
                  </div>
                  <div className="pl-row2" style={{ marginTop: 12 }}>
                    <button className="pl-btn primary" onClick={() => setView("subscriptions")}>
                      View plans
                    </button>
                    <button className="pl-btn ghost" onClick={openSubscriptionCheckout}>
                      Quick checkout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="pl-kv">
                    <div className="k">Tier</div>
                    <div className="v">{persisted.subscription.tier}</div>
                  </div>
                  <div className="pl-kv">
                    <div className="k">Billing</div>
                    <div className="v">
                      {persisted.subscription.cycle} • INR {persisted.subscription.price}
                    </div>
                  </div>
                  <div className="pl-kv">
                    <div className="k">Renews</div>
                    <div className="v">{persisted.subscription.renewsAt ? fmtDate(persisted.subscription.renewsAt) : "-"}</div>
                  </div>

                  <div className="pl-row2" style={{ marginTop: 12 }}>
                    <button className="pl-btn ghost" onClick={() => setView("subscriptions")}>
                      Change plan
                    </button>
                    <button className="pl-btn danger ghost" onClick={cancelSubscription}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="pl-panel-head">
                <h3>Coach</h3>
                <span className="pl-pill subtle">{bookedCoach ? "Booked" : "Not booked"}</span>
              </div>

              {!bookedCoach ? (
                <>
                  <div className="pl-muted" style={{ marginTop: 10 }}>
                    Hire a coach for plan reviews, accountability, and technique guidance.
                  </div>
                  {!hasElite && (
                    <div className="pl-callout">
                      Coach hiring is available in the Elite tier. You can still browse coaches.
                    </div>
                  )}
                  <div className="pl-row2" style={{ marginTop: 12 }}>
                    <button className="pl-btn primary" onClick={() => setView("coaches")}>
                      Browse coaches
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="pl-coach">
                    <div className="pl-coach-name">{bookedCoach.name}</div>
                    <div className="pl-muted mini">{bookedCoach.title}</div>
                    <div className="pl-muted mini" style={{ marginTop: 6 }}>
                      Specialty: {bookedCoach.specialty} • Rating {bookedCoach.rating} • {bookedCoach.reviews} reviews
                    </div>
                  </div>

                  <div className="pl-row2" style={{ marginTop: 12 }}>
                    <button className="pl-btn ghost" onClick={() => setView("coaches")}>
                      Change coach
                    </button>
                    <button className="pl-btn danger ghost" onClick={unbookCoach}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="pl-panel-head">
                <h3>Quick actions</h3>
                <span className="pl-pill subtle">Shortcuts</span>
              </div>
              <div className="pl-row2" style={{ marginTop: 12 }}>
                <button className="pl-btn ghost" onClick={() => setView("builder")}>Edit weekly plan</button>
                <button className="pl-btn ghost" onClick={() => { setSelectedTier("Pro"); setCycle("Monthly"); openSubscriptionCheckout(); }}>
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions */}
      {view === "subscriptions" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="pl-panel-head">
            <h3>Subscription plans</h3>
            <div className="pl-cycle">
              <button className={`pl-chip ${cycle === "Weekly" ? "active" : ""}`} onClick={() => setCycle("Weekly")}>Weekly</button>
              <button className={`pl-chip ${cycle === "Monthly" ? "active" : ""}`} onClick={() => setCycle("Monthly")}>Monthly</button>
              <button className={`pl-chip ${cycle === "Yearly" ? "active" : ""}`} onClick={() => setCycle("Yearly")}>Yearly</button>
            </div>
          </div>

          <div className="pl-tier-grid">
            {SUBSCRIPTIONS.map((s) => {
              const price = cycle === "Weekly" ? s.weekly : cycle === "Monthly" ? s.monthly : s.yearly;
              const selected = selectedTier === s.tier;

              return (
                <div key={s.tier} className={`pl-tier ${selected ? "selected" : ""}`}>
                  <div className="pl-tier-top">
                    <div>
                      <div className="pl-tier-name">{s.label}</div>
                      <div className="pl-muted mini">{s.description}</div>
                    </div>
                    {s.popular && <span className="pl-pill">Most popular</span>}
                  </div>

                  <div className="pl-price">
                    <div className="pl-price-amt">INR {price}</div>
                    <div className="pl-muted mini">per {cycle.toLowerCase()}</div>
                  </div>

                  <div className="pl-feature-list">
                    {s.features.map((f) => (
                      <div key={f} className="pl-feature">{f}</div>
                    ))}
                  </div>

                  <div className="pl-row2" style={{ marginTop: 12 }}>
                    <button className={`pl-btn ${selected ? "primary" : "ghost"}`} onClick={() => setSelectedTier(s.tier)}>
                      {selected ? "Selected" : "Select"}
                    </button>
                    <button className="pl-btn primary" onClick={openSubscriptionCheckout}>
                      Continue
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pl-muted mini" style={{ marginTop: 10 }}>
            Payments are shown as a UI flow. Integrate Stripe/Razorpay with a backend for real transactions.
          </div>
        </div>
      )}

      {/* Coaches */}
      {view === "coaches" && (
        <div className="pl-coaches">
          <div className="card" style={{ marginTop: 12 }}>
            <div className="pl-panel-head">
              <h3>Coach marketplace</h3>
              <span className="pl-pill subtle">{filteredCoaches.length} results</span>
            </div>

            <div className="pl-coach-filters">
              <label className="pl-field">
                <span>Search</span>
                <input value={coachQuery} onChange={(e) => setCoachQuery(e.target.value)} placeholder="Name, specialty, keywords..." />
              </label>

              <label className="pl-field">
                <span>Specialty</span>
                <select value={coachSpecialty} onChange={(e) => setCoachSpecialty(e.target.value as any)}>
                  <option value="All">All</option>
                  <option value="Strength">Strength</option>
                  <option value="Weight loss">Weight loss</option>
                  <option value="Mobility">Mobility</option>
                  <option value="Rehab">Rehab</option>
                  <option value="Sports">Sports</option>
                </select>
              </label>
            </div>

            <div className="pl-coach-grid">
              {filteredCoaches.map((c) => {
                const isBooked = persisted.bookedCoachId === c.id;
                return (
                  <div key={c.id} className="pl-coach-card">
                    <div className="pl-coach-card-top">
                      <div>
                        <div className="pl-coach-name">{c.name}</div>
                        <div className="pl-muted mini">{c.title}</div>
                      </div>
                      <span className={`pl-pill subtle ${c.availability === "Limited slots" ? "warn" : ""}`}>
                        {c.availability}
                      </span>
                    </div>

                    <div className="pl-muted mini" style={{ marginTop: 8 }}>
                      Specialty: {c.specialty} • {c.years} years • Rating {c.rating} ({c.reviews})
                    </div>

                    <div className="pl-muted mini" style={{ marginTop: 6 }}>
                      Languages: {c.language.join(", ")}
                    </div>

                    <div className="pl-price-row">
                      <div className="pl-price-amt">INR {c.pricePerMonth}</div>
                      <div className="pl-muted mini">per month</div>
                    </div>

                    <div className="pl-feature-list">
                      {c.highlights.map((h) => (
                        <div key={h} className="pl-feature">{h}</div>
                      ))}
                    </div>

                    <div className="pl-row2" style={{ marginTop: 12 }}>
                      <button className="pl-btn ghost" onClick={() => setSelectedCoachId(c.id)}>View</button>
                      <button
                        className={`pl-btn ${isBooked ? "ghost" : "primary"}`}
                        onClick={() => openCoachCheckout(c.id)}
                        disabled={!hasElite && !isBooked}
                        title={!hasElite ? "Coach hiring requires Elite tier" : ""}
                      >
                        {isBooked ? "Booked" : "Hire coach"}
                      </button>
                    </div>

                    {!hasElite && !isBooked && (
                      <div className="pl-muted mini" style={{ marginTop: 8 }}>
                        Upgrade to Elite to hire coaches.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coach profile drawer */}
          {selectedCoach && (
            <div className="pl-modal" role="dialog" aria-modal="true">
              <div className="pl-drawer card">
                <div className="pl-drawer-head">
                  <div>
                    <div className="pl-drawer-title">{selectedCoach.name}</div>
                    <div className="pl-muted mini">{selectedCoach.title}</div>
                    <div className="pl-muted mini" style={{ marginTop: 6 }}>
                      Specialty: {selectedCoach.specialty} • Rating {selectedCoach.rating} • {selectedCoach.reviews} reviews
                    </div>
                  </div>
                  <button className="pl-icon" onClick={() => setSelectedCoachId(null)} title="Close">×</button>
                </div>

                <p className="pl-muted" style={{ marginTop: 10 }}>{selectedCoach.bio}</p>

                <div className="pl-kv-grid">
                  <div className="pl-kv"><div className="k">Experience</div><div className="v">{selectedCoach.years} years</div></div>
                  <div className="pl-kv"><div className="k">Languages</div><div className="v">{selectedCoach.language.join(", ")}</div></div>
                  <div className="pl-kv"><div className="k">Availability</div><div className="v">{selectedCoach.availability}</div></div>
                  <div className="pl-kv"><div className="k">Pricing</div><div className="v">INR {selectedCoach.pricePerMonth} / month</div></div>
                </div>

                <div className="pl-feature-list" style={{ marginTop: 12 }}>
                  {selectedCoach.highlights.map((h) => (
                    <div key={h} className="pl-feature">{h}</div>
                  ))}
                </div>

                <div className="pl-row2" style={{ marginTop: 14, justifyContent: "flex-end" }}>
                  <button className="pl-btn ghost" onClick={() => setSelectedCoachId(null)}>Close</button>
                  <button
                    className="pl-btn primary"
                    onClick={() => openCoachCheckout(selectedCoach.id)}
                    disabled={!hasElite}
                  >
                    Hire coach
                  </button>
                </div>

                {!hasElite && (
                  <div className="pl-callout" style={{ marginTop: 10 }}>
                    Coach hiring requires the Elite subscription. You can still view profiles.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plan builder */}
      {view === "builder" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="pl-panel-head">
            <h3>Plan builder</h3>
            <div className="pl-row2">
              <button className="pl-btn ghost" onClick={resetDraft}>Reset to default</button>
              <button className="pl-btn primary" onClick={saveDraft}>Save</button>
            </div>
          </div>

          <div className="pl-builder">
            {planDraft.map((d) => (
              <div key={d.day} className="pl-builder-row">
                <div className="pl-day">{d.day}</div>

                <label className="pl-field" style={{ marginTop: 0 }}>
                  <span>Focus</span>
                  <input value={d.focus} onChange={(e) => updateDraft(d.day, e.target.value, d.status)} />
                </label>

                <label className="pl-field" style={{ marginTop: 0 }}>
                  <span>Status</span>
                  <select value={d.status} onChange={(e) => updateDraft(d.day, d.focus, e.target.value as any)}>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Rest">Rest</option>
                  </select>
                </label>
              </div>
            ))}
          </div>

          <div className="pl-muted mini" style={{ marginTop: 10 }}>
            Edit focus and status. In production, plan generation should be done via a service with user goals and constraints.
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="pl-modal" role="dialog" aria-modal="true">
          <div className="pl-checkout card">
            <div className="pl-drawer-head">
              <div>
                <div className="pl-drawer-title">Checkout</div>
                <div className="pl-muted mini">
                  {checkoutMode === "subscription"
                    ? `Subscription: ${selectedTier} • ${cycle} • INR ${priceForSelection}`
                    : selectedCoach
                      ? `Coach: ${selectedCoach.name} • INR ${selectedCoach.pricePerMonth} / month`
                      : "Coach checkout"}
                </div>
              </div>
              <button className="pl-icon" onClick={closeCheckout} title="Close">×</button>
            </div>

            <div className="pl-check-grid">
              <div>
                <div className="pl-panel-head">
                  <h3>Payment method</h3>
                  <span className="pl-pill subtle">Secure UI flow</span>
                </div>

                <div className="pl-methods">
                  {(["UPI", "Card", "NetBanking"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      className={`pl-method ${paymentMethod === m ? "active" : ""}`}
                      onClick={() => setPaymentMethod(m)}
                      type="button"
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="pl-muted mini" style={{ marginTop: 10 }}>
                  Payments are mocked for UI. Integrate a payment gateway (Razorpay/Stripe) for real transactions.
                </div>

                <div className="pl-panel-head" style={{ marginTop: 14 }}>
                  <h3>Billing details</h3>
                  <span className="pl-pill subtle">Receipt</span>
                </div>

                <div className="pl-form">
                  <label className="pl-field">
                    <span>Full name</span>
                    <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Name" />
                  </label>
                  <label className="pl-field">
                    <span>Email</span>
                    <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="Email" />
                  </label>
                  <label className="pl-field">
                    <span>Phone</span>
                    <input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="Phone" />
                  </label>
                </div>
              </div>

              <div className="pl-summary">
                <div className="pl-panel-head">
                  <h3>Order summary</h3>
                  <span className="pl-pill">Total</span>
                </div>

                <div className="pl-summary-box">
                  {checkoutMode === "subscription" ? (
                    <>
                      <div className="pl-sum-row">
                        <div className="k">Plan</div>
                        <div className="v">{selectedTier}</div>
                      </div>
                      <div className="pl-sum-row">
                        <div className="k">Billing cycle</div>
                        <div className="v">{cycle}</div>
                      </div>
                      <div className="pl-sum-row">
                        <div className="k">Amount</div>
                        <div className="v">INR {priceForSelection}</div>
                      </div>
                      <div className="pl-divider" />
                      <div className="pl-sum-row total">
                        <div className="k">Total payable</div>
                        <div className="v">INR {priceForSelection}</div>
                      </div>

                      <button className="pl-btn primary" style={{ width: "100%", marginTop: 12 }} onClick={activateSubscription}>
                        Pay and activate
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="pl-sum-row">
                        <div className="k">Coach</div>
                        <div className="v">{selectedCoach?.name ?? "-"}</div>
                      </div>
                      <div className="pl-sum-row">
                        <div className="k">Billing</div>
                        <div className="v">Monthly</div>
                      </div>
                      <div className="pl-sum-row">
                        <div className="k">Amount</div>
                        <div className="v">INR {selectedCoach?.pricePerMonth ?? "-"}</div>
                      </div>
                      <div className="pl-divider" />
                      <div className="pl-sum-row total">
                        <div className="k">Total payable</div>
                        <div className="v">INR {selectedCoach?.pricePerMonth ?? "-"}</div>
                      </div>

                      <button className="pl-btn primary" style={{ width: "100%", marginTop: 12 }} onClick={bookCoach} disabled={!hasElite}>
                        Pay and hire coach
                      </button>

                      {!hasElite && (
                        <div className="pl-callout" style={{ marginTop: 10 }}>
                          Coach hiring requires Elite subscription.
                        </div>
                      )}
                    </>
                  )}

                  <button className="pl-btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={closeCheckout}>
                    Cancel
                  </button>
                </div>

                <div className="pl-muted mini" style={{ marginTop: 10 }}>
                  By continuing, you agree to the app terms and recurring billing policy.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}