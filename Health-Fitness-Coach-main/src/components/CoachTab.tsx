import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModelCategory } from "@runanywhere/web";
import { TextGeneration } from "@runanywhere/web-llamacpp";
import { useGlobalModelLoader } from "../hooks/useGlobalModelLoader";
import { ModelBanner } from "./ModelBanner";
import { GeminiService } from "../services/GeminiService";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
}

const STORAGE_KEY = "fitnesscoach:coachchat:v1";

const SYSTEM_PROMPT =
  "You are an expert Health and Fitness Coach. Provide concise, actionable advice on training, nutrition, recovery, and lifestyle. " +
  "Be supportive and realistic. Ask one clarifying question only when necessary. Avoid medical diagnosis. " +
  "Format answers with short headings and bullet points when helpful.";

function uid(prefix = "m") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function loadChat(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m.id === "string")
      .map((m) => ({
        id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
        text: typeof m.text === "string" ? m.text : "",
        createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function saveChat(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore storage errors
  }
}

function buildLocalPrompt(messages: Message[]) {
  // Lightweight conversation formatting to keep model consistent.
  // If you later migrate to a chat-template backend, replace this.
  const history = messages
    .slice(-12)
    .map((m) => (m.role === "user" ? `User: ${m.text}` : `Coach: ${m.text}`))
    .join("\n");

  return `${SYSTEM_PROMPT}\n\n${history}\nCoach:`;
}

function exportAsTxt(messages: Message[]) {
  const lines = messages.map((m) => {
    const t = new Date(m.createdAt).toLocaleString();
    const speaker = m.role === "user" ? "User" : "Coach";
    return `[${t}] ${speaker}: ${m.text}`;
  });
  const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "coach-chat.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const SUGGESTIONS = [
  "Create a 4-week workout plan for fat loss with 45 minutes per day.",
  "Build a vegetarian high-protein diet plan for 1,700 calories.",
  "Suggest a weekly plan to improve stamina and overall fitness.",
  "I have knee pain during squats. What should I change?",
  "How many steps and cardio sessions per week are ideal for beginners?",
];
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Typewriter that updates the assistant bubble gradually
async function typeInto(
  text: string,
  onChunk: (partial: string) => void,
  speedMs = 12
) {
  let out = "";
  for (const ch of text) {
    out += ch;
    onChunk(out);
    // small random jitter makes it feel natural
    await sleep(speedMs + Math.floor(Math.random() * 10));
  }
}

const OFFLINE_ANSWERS: Record<string, string> = {
  "Create a 4-week workout plan for fat loss with 45 minutes per day.": `4-Week Fat Loss Plan (45 minutes/day)

Weekly structure (repeat each week)
- Day 1: Full-body strength + short finisher
- Day 2: Cardio intervals + core
- Day 3: Upper-body strength + brisk incline walk
- Day 4: Lower-body strength + mobility
- Day 5: Steady-state cardio + posture work
- Day 6: Conditioning circuit (low-impact option included)
- Day 7: Recovery (walk + stretching)

Strength days (35 min)
- Warm-up (5): brisk walk + dynamic mobility
- Main (25): 4 exercises, 3 sets each, 8–12 reps
  1) Squat pattern (goblet squat / split squat)
  2) Push (push-ups / dumbbell press)
  3) Pull (rows / band rows)
  4) Hinge (RDL / hip hinge)
- Finisher (5): 30 sec fast + 30 sec easy × 5

Cardio interval day (35 min)
- 5 min warm-up
- 18–22 min intervals: 40 sec hard / 80 sec easy
- 8 min core: plank variations, dead bug, side plank
- 2–3 min cooldown

Progression rules
- Week 1: moderate effort, perfect form
- Week 2: add 1 set to two exercises
- Week 3: slightly heavier or +2 reps per set
- Week 4: keep strength, increase cardio time by 10–15%

Quick question: do you have dumbbells or only bodyweight?`,

  "Build a vegetarian high-protein diet plan for 1,700 calories.": `Vegetarian High-Protein Plan (Approx. 1,700 kcal)

Daily targets (adjustable)
- Protein: 95–115 g
- Carbs: 180–210 g
- Fat: 45–55 g

Breakfast (400–450 kcal)
- Greek yogurt / dahi (250 g) + oats (40 g) + fruit
- Add chia/flax (1 tbsp)
Protein: ~25–30 g

Lunch (500–550 kcal)
- Paneer/tofu (150 g) OR dal (1.5 cups)
- 2 rotis OR 1 cup cooked rice
- Large salad + curd
Protein: ~30–35 g

Snack (250–300 kcal)
- Roasted chana (50–60 g) OR protein smoothie (milk + whey if you use it)
Protein: ~15–25 g

Dinner (450–500 kcal)
- Dal/rajma/chole (1.5 cups) + vegetables
- 1–2 rotis OR quinoa/rice portion
Protein: ~25–30 g

Simple rules to make it work
- Keep one high-protein anchor in every meal (paneer/tofu/dal/curd).
- Add vegetables for volume.
- Use 1–2 tsp oil per meal.

Quick question: do you include whey/soy protein, or fully food-only?`,

  "Suggest a weekly plan to improve stamina and overall fitness.": `Weekly Stamina + Fitness Plan

Goal: improve endurance without burning out.

Day 1: Strength (full body) + 10 min easy cardio
Day 2: Cardio intervals (20–25 min) + mobility
Day 3: Zone-2 cardio (30–45 min) comfortable pace
Day 4: Strength (upper/lower split) + core
Day 5: Tempo cardio (15–20 min) moderate hard + walk
Day 6: Long easy activity (45–60 min) walking/cycling
Day 7: Recovery (stretching + light walk)

Progression
- Add 5 minutes to the easy days every week
- Add 1–2 interval rounds every 2 weeks
- Keep strength stable, focus on form

Quick question: what cardio do you prefer (walking, running, cycling, skipping)?`,

  "I have knee pain during squats. What should I change?": `Knee pain during squats usually comes from technique, mobility, or load.

Immediate fixes (try today)
- Reduce depth: squat only to a pain-free range
- Slow tempo: 3 seconds down, 1 second pause
- Keep knees tracking over toes (no collapse inward)
- Shift to a hip-dominant version: box squat or goblet squat

Form cues
- Tripod foot: big toe, little toe, heel pressed
- Slight forward lean is OK; keep spine neutral
- Start with bodyweight, then add load gradually

Mobility/strength support (5–8 min)
- Glute bridges 2×12
- Side-lying clamshells 2×12
- Calf stretch 60 sec each side
- Ankle rocks 10 reps each side

If pain is sharp, swelling, or persists after reducing range/load, stop squats for now and switch to pain-free movements.

Quick question: is the pain in front of the knee, inside, or below the kneecap?`,

  "How many steps and cardio sessions per week are ideal for beginners?": `Beginner targets (simple and effective)

Steps
- Start: 6,000–8,000 steps/day (most beginners can sustain this)
- After 2–3 weeks: 8,000–10,000 steps/day if recovery is good

Cardio sessions
- 3 sessions/week is ideal to start
- Each 20–30 minutes at a conversational pace (Zone 2)
- Optional: 1 short interval session after 2–3 weeks

Weekly structure example
- Mon: walk + light strength
- Wed: walk (20–30 min)
- Fri: walk/cycle (20–30 min)
- Sat: longer walk (40 min)

Quick question: what’s your current daily step range roughly?`,
};

export function CoachTab() {
  const loader = useGlobalModelLoader(ModelCategory.Language);

  const [messages, setMessages] = useState<Message[]>(() => loadChat());
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const cancelLocalRef = useRef<(() => void) | null>(null);
  const abortCloudRef = useRef<{ aborted: boolean } | null>(null);

  const lastUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i];
    }
    return null;
  }, [messages]);

  // preload model once
  useEffect(() => {
    loader.ensure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist + autoscroll
  useEffect(() => {
    saveChat(messages);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const updateMessageById = useCallback((id: string, nextText: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: nextText } : m)));
  }, []);

  const stop = useCallback(() => {
    abortCloudRef.current && (abortCloudRef.current.aborted = true);
    cancelLocalRef.current?.();
    cancelLocalRef.current = null;
    setGenerating(false);
  }, []);

  const clearChat = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
    setInput("");
  }, [stop]);

  const sendFallback = useCallback(
  async (text: string) => {
    if (generating) return;

    setError(null);

    const userMsg: Message = { id: uid("u"), role: "user", text, createdAt: Date.now() };
    const assistantId = uid("a");
    const assistantMsg: Message = { id: assistantId, role: "assistant", text: "", createdAt: Date.now() };

    setInput("");
    setGenerating(true);
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const answer =
      OFFLINE_ANSWERS[text] ||
      `I can help with this. For best results, share: goal, timeframe, current level, equipment, and any constraints.`;

    await typeInto(answer, (partial) => updateMessageById(assistantId, partial), 10);

    setGenerating(false);
  },
  [generating, updateMessageById]
);

  const send = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim();
      if (!text || generating) return;

      setError(null);

      // Ensure local model if needed
      if (loader.state !== "ready") {
        const ok = await loader.ensure();
        if (!ok) return;
      }

      // Create message IDs (avoid index bugs)
      const userMsg: Message = { id: uid("u"), role: "user", text, createdAt: Date.now() };
      const assistantId = uid("a");
      const assistantMsg: Message = { id: assistantId, role: "assistant", text: "", createdAt: Date.now() };

      setInput("");
      setGenerating(true);

      // push both messages atomically
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const isLocalOnly = localStorage.getItem("fitness-local-only-mode") === "true";
      const isCloudEnabled = localStorage.getItem("fitness-ai-cloud-mode") !== "false";

      // --- Cloud path (stream) ---
      if (!isLocalOnly && isCloudEnabled && GeminiService.isSupported) {
        try {
          const abort = { aborted: false };
          abortCloudRef.current = abort;

          let accumulated = "";
          for await (const chunk of GeminiService.chatStream(text, SYSTEM_PROMPT)) {
            if (abort.aborted) break;
            accumulated += chunk;
            updateMessageById(assistantId, accumulated);
          }

          abortCloudRef.current = null;
          setGenerating(false);
          return;
        } catch (e) {
          // fallback to local
          console.warn("[CoachTab] Cloud failed; falling back to local:", e);
        }
      }

      // --- Local path (stream) ---
      try {
        const fastMode = localStorage.getItem("fitness-ai-fast-mode") === "true";

        // Build prompt using last N messages including the newest user message
        const snapshotForPrompt = [...messages, userMsg].filter(Boolean);
        const fullPrompt = buildLocalPrompt(snapshotForPrompt);

        const { stream, result: resultPromise, cancel } = await TextGeneration.generateStream(fullPrompt, {
          maxTokens: fastMode ? 160 : 320,
          temperature: 0.7,
          stopSequences: ["User:", "Coach:"],
        });

        cancelLocalRef.current = cancel;

        let accumulated = "";
        for await (const token of stream) {
          accumulated += token;
          updateMessageById(assistantId, accumulated);
        }

        await resultPromise;
      } catch (err) {
        let msg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        if (msg.includes("-135")) {
          msg =
            "The model is busy or out of memory. Close other heavy tabs, reload the app, or enable Fast mode in Settings.";
        }
        updateMessageById(assistantId, msg);
        setError(msg);
      } finally {
        cancelLocalRef.current = null;
        abortCloudRef.current = null;
        setGenerating(false);
      }
    },
    [input, generating, loader, messages, updateMessageById]
  );

  const regenerate = useCallback(async () => {
    if (generating) return;
    if (!lastUserMessage) return;

    // Remove last assistant message (if exists) and regenerate for last user message
    setMessages((prev) => {
      const next = [...prev];
      // remove trailing assistant if last item is assistant
      if (next.length && next[next.length - 1].role === "assistant") next.pop();
      return next;
    });

    await send(lastUserMessage.text);
  }, [generating, lastUserMessage, send]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  const headerStatus = useMemo(() => {
    if (generating) return "Generating";
    if (loader.state !== "ready") return "Model not loaded";
    return "Ready";
  }, [generating, loader.state]);

  return (
    <div className="ct-wrap">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="Coach"
        category={ModelCategory.Language}
      />

      <div className="ct-header card">
        <div>
          <div className="ct-badge">Coach</div>
          <h2>Personal training and nutrition guidance</h2>
          <p className="ct-muted">
            Ask about routines, goals, recovery, vegetarian diet planning, and training consistency.
          </p>
        </div>

        <div className="ct-actions">
          <span className={`ct-status ${generating ? "busy" : ""}`}>{headerStatus}</span>
          <button className="ct-btn ghost" onClick={() => exportAsTxt(messages)} disabled={!messages.length}>
            Export
          </button>
          <button className="ct-btn ghost" onClick={clearChat} disabled={!messages.length || generating}>
            New chat
          </button>
          <button className="ct-btn danger ghost" onClick={stop} disabled={!generating}>
            Stop
          </button>
        </div>
      </div>

      <div className="ct-main">
        <div className="ct-thread card" ref={listRef}>
          {messages.length === 0 ? (
            <div className="ct-empty">
              <div className="ct-empty-title">Start a conversation</div>
              <div className="ct-muted">
                Use one of the prompts below or ask your own question. This is designed for practical, actionable coaching.
              </div>

              <div className="ct-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="ct-suggestion"
                    onClick={() => send(s)}
                    disabled={generating}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ct-messages">
              {messages.map((m) => (
                <div key={m.id} className={`ct-msg ${m.role}`}>
                  <div className="ct-role">{m.role === "user" ? "You" : "Coach"}</div>
                  <div className="ct-bubble">
                    <div className="ct-text">{m.text || "…"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ct-side card">
          <div className="ct-panel-head">
            <h3>Session tools</h3>
            <span className="ct-pill subtle">Utilities</span>
          </div>

          <div className="ct-tool">
            <div className="ct-tool-title">Regenerate response</div>
            <div className="ct-muted mini">Re-run the last answer for the latest question.</div>
            <button className="ct-btn primary" onClick={regenerate} disabled={!lastUserMessage || generating}>
              Regenerate
            </button>
          </div>

          <div className="ct-divider" />

          <div className="ct-tool">
            <div className="ct-tool-title">Quality tip</div>
            <div className="ct-muted mini">
              Provide your goal, timeframe, current level, and constraints (equipment, injuries, schedule). Output becomes more precise.
            </div>
          </div>

          {error && (
            <>
              <div className="ct-divider" />
              <div className="ct-error">
                <div className="ct-error-title">Last error</div>
                <div className="ct-muted mini">{error}</div>
              </div>
            </>
          )}
        </div>
      </div>

      <form className="ct-input card" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach..."
          disabled={generating}
        />
        <button className="ct-btn primary" type="submit" disabled={!input.trim() || generating}>
          Send
        </button>
      </form>
    </div>
  );
}