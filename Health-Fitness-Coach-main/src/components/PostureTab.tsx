import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

type Exercise = "standing" | "squat" | "pushup" | "plank";

type Feedback = {
  status: "correct" | "warning" | "bad" | "no_person";
  title: string;
  tips: string[];
  metrics?: Record<string, string>;
};

const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const DEFAULT_FPS_TARGET = 30;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleABC(a: any, b: any, c: any) {
  // angle at B
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  const cos = dot / (magAB * magCB + 1e-9);
  const ang = Math.acos(clamp(cos, -1, 1));
  return (ang * 180) / Math.PI;
}

function avg(a: number, b: number) {
  return (a + b) / 2;
}

function fmt(n: number, d = 0) {
  return Number.isFinite(n) ? n.toFixed(d) : "-";
}

function pickSide(landmarks: any[], idxL: number, idxR: number) {
  // choose side with higher visibility if available; fallback left
  const L = landmarks[idxL];
  const R = landmarks[idxR];
  const vL = L?.visibility ?? 1;
  const vR = R?.visibility ?? 1;
  return vR > vL ? { side: "right" as const, p: R } : { side: "left" as const, p: L };
}

export function PostureTab() {
  const [exercise, setExercise] = useState<Exercise>("standing");
  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({
    status: "no_person",
    title: "Start camera to begin",
    tips: ["Keep your full body in frame."],
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTSRef = useRef<number>(0);

  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    const v = videoRef.current;
    if (v && v.srcObject) {
      const tracks = (v.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      v.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  // init pose landmarker once
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setErr(null);

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      stopAll();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [stopAll]);

  const startCamera = useCallback(async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();

      setCameraOn(true);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, []);

  function ensureCanvasSize() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const vw = v.videoWidth || 1280;
    const vh = v.videoHeight || 720;

    // match actual video pixels for correct overlay scaling
    if (c.width !== vw) c.width = vw;
    if (c.height !== vh) c.height = vh;
  }

  function makeFeedback(ex: Exercise, res: PoseLandmarkerResult): Feedback {
    const lm = res?.landmarks?.[0];
    if (!lm || lm.length < 33) {
      return {
        status: "no_person",
        title: "No person detected",
        tips: ["Move back a little", "Make sure lighting is good", "Keep full body visible"],
      };
    }

    // MediaPipe Pose landmark indexes:
    // 11 L shoulder, 12 R shoulder, 23 L hip, 24 R hip, 25 L knee, 26 R knee, 27 L ankle, 28 R ankle
    // 13 L elbow, 14 R elbow, 15 L wrist, 16 R wrist
    // 0 nose

    const Ls = lm[11], Rs = lm[12];
    const Lh = lm[23], Rh = lm[24];
    const Lk = lm[25], Rk = lm[26];
    const La = lm[27], Ra = lm[28];
    const Le = lm[13], Re = lm[14];
    const Lw = lm[15], Rw = lm[16];

    // Basic “confidence” check using visibility
    const visAvg =
      avg(avg(Ls.visibility ?? 1, Rs.visibility ?? 1), avg(Lh.visibility ?? 1, Rh.visibility ?? 1));
    if (visAvg < 0.4) {
      return {
        status: "no_person",
        title: "Low visibility",
        tips: ["Stand in better light", "Keep whole body in frame"],
      };
    }

    // Symmetry / alignment metrics (using normalized coords)
    const shoulderTilt = Math.abs((Ls.y ?? 0) - (Rs.y ?? 0)); // smaller better
    const hipTilt = Math.abs((Lh.y ?? 0) - (Rh.y ?? 0));

    // choose dominant side (better visibility) for angle checks
    const kneePick = pickSide(lm, 25, 26);
    const anklePick = pickSide(lm, 27, 28);
    const hipPick = pickSide(lm, 23, 24);
    const shoulderPick = pickSide(lm, 11, 12);
    const elbowPick = pickSide(lm, 13, 14);
    const wristPick = pickSide(lm, 15, 16);

    const hip = hipPick.p;
    const knee = kneePick.p;
    const ankle = anklePick.p;
    const shoulder = shoulderPick.p;
    const elbow = elbowPick.p;
    const wrist = wristPick.p;

    // angles
    const kneeAngle = angleABC(hip, knee, ankle); // squat depth
    const hipAngle = angleABC(shoulder, hip, knee); // torso vs thigh
    const elbowAngle = angleABC(shoulder, elbow, wrist); // pushup lock
    const shoulderToHip = dist(shoulder, hip);

    // Generic “straightness”: shoulder-hip-knee angle near 180 => straighter
    const torsoAngle = angleABC(shoulder, hip, knee);

    const tips: string[] = [];
    const metrics: Record<string, string> = {
      "Shoulder tilt": fmt(shoulderTilt * 100, 1) + "%",
      "Hip tilt": fmt(hipTilt * 100, 1) + "%",
      "Knee angle": fmt(kneeAngle, 0) + "°",
      "Torso angle": fmt(torsoAngle, 0) + "°",
    };

    // Common checks (standing)
    if (shoulderTilt > 0.03) tips.push("Level your shoulders (avoid leaning).");
    if (hipTilt > 0.03) tips.push("Level your hips (avoid shifting weight to one side).");

    // Exercise-specific rules
    if (ex === "standing") {
      // simple: torso reasonably vertical (hipAngle ~ 170-180)
      if (torsoAngle < 155) tips.push("Stand taller: lift chest, brace core, avoid bending.");
      const status =
        tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Posture looks good" : "Adjust your posture",
        tips: tips.length ? tips : ["Nice! Keep core engaged and neck neutral."],
        metrics,
      };
    }

    if (ex === "squat") {
      // Good squat (rough, practical rules):
      // - knees not collapsing inward (hard to check without full frontal; we'll check knee x vs ankle x on chosen side)
      // - torso not collapsing forward too much
      // - depth: kneeAngle ~ 70-110 (lower = deeper)
      const kneeOverToe = Math.abs((knee.x ?? 0) - (ankle.x ?? 0));
      metrics["Knee over toe"] = fmt(kneeOverToe * 100, 1) + "%";

      if (kneeAngle > 140) tips.push("Go lower: bend knees more for a proper squat.");
      if (kneeAngle < 55) tips.push("Too deep for now—control your depth and keep form stable.");
      if (torsoAngle < 135) tips.push("Chest up: reduce forward lean, brace your core.");
      if (kneeOverToe > 0.08) tips.push("Keep knee stacked over ankle (avoid drifting too far).");

      const status =
        tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Squat form looks solid" : "Fix squat form",
        tips: tips.length ? tips : ["Great! Keep heels grounded and knees tracking over toes."],
        metrics,
      };
    }

    if (ex === "pushup") {
      // Push-up checks (side view works best; but we’ll do best effort):
      // - body line straight: shoulder-hip-ankle ~ 170-180
      // - elbows not flared too much is tricky without 3D; we’ll focus on line + elbow bend
      const bodyLine = angleABC(shoulder, hip, ankle);
      metrics["Body line"] = fmt(bodyLine, 0) + "°";
      metrics["Elbow angle"] = fmt(elbowAngle, 0) + "°";

      if (bodyLine < 160) tips.push("Keep body straight: tighten core, avoid sagging hips.");
      if (elbowAngle > 165) tips.push("Go lower: bend elbows more (controlled range).");
      if (elbowAngle < 55) tips.push("Too low—keep control and avoid collapsing.");
      if (shoulderToHip < 0.10) tips.push("Move slightly back so full upper body is visible.");

      const status =
        tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Push-up posture good" : "Fix push-up posture",
        tips: tips.length ? tips : ["Nice! Maintain a straight line and steady tempo."],
        metrics,
      };
    }

    if (ex === "plank") {
      const bodyLine = angleABC(shoulder, hip, ankle);
      metrics["Body line"] = fmt(bodyLine, 0) + "°";

      if (bodyLine < 165) tips.push("Straighten line: tuck pelvis slightly & brace core.");
      if (torsoAngle < 150) tips.push("Neck neutral: look down, avoid craning forward.");
      if (shoulderToHip < 0.10) tips.push("Step back so shoulders and hips are visible.");

      const status =
        tips.length === 0 ? "correct" : tips.length <= 2 ? "warning" : "bad";
      return {
        status,
        title: status === "correct" ? "Plank looks good" : "Fix plank posture",
        tips: tips.length ? tips : ["Great hold. Keep core tight and hips steady."],
        metrics,
      };
    }

    return { status: "warning", title: "Tracking", tips: ["Hold steady…"], metrics };
  }

  const loop = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!v || !c || !landmarker) return;

    // FPS throttle
    const now = performance.now();
    const minDelta = 1000 / DEFAULT_FPS_TARGET;
    if (now - lastTSRef.current < minDelta) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    lastTSRef.current = now;

    ensureCanvasSize();

    const ctx = c.getContext("2d");
    if (!ctx) return;

    // detect
    const res = landmarker.detectForVideo(v, now);

    // draw video frame
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(v, 0, 0, c.width, c.height);

    // draw landmarks
    const drawing = new DrawingUtils(ctx);
    const lm = res.landmarks?.[0];
    if (lm && lm.length) {
      drawing.drawLandmarks(lm, { radius: 3 });
      drawing.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);
    }

    // compute feedback
    setFeedback(makeFeedback(exercise, res));

    rafRef.current = requestAnimationFrame(loop);
  }, [exercise]);

  useEffect(() => {
    if (!cameraOn) return;
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [cameraOn, loop]);

  const badge = useMemo(() => {
    if (feedback.status === "correct") return { text: "CORRECT", cls: "ok" };
    if (feedback.status === "warning") return { text: "ADJUST", cls: "warn" };
    if (feedback.status === "bad") return { text: "FIX NOW", cls: "bad" };
    return { text: "NO PERSON", cls: "none" };
  }, [feedback.status]);

  return (
    <div className="posture-pro">
      <div className="pp-head">
        <div>
          <div className="pp-badge">Posture</div>
          <h2>Real-time Posture Detection</h2>
          <p className="pp-muted">
            Accurate skeleton tracking (MediaPipe Pose). Best results when your whole body is visible.
          </p>
        </div>

        <div className="pp-controls">
          <label className="pp-field">
            <span>Exercise</span>
            <select value={exercise} onChange={(e) => setExercise(e.target.value as Exercise)}>
              <option value="standing">Standing posture</option>
              <option value="squat">Squat</option>
              <option value="pushup">Push-up</option>
              <option value="plank">Plank</option>
            </select>
          </label>

          {!cameraOn ? (
            <button className="pp-btn pp-primary" onClick={startCamera} disabled={loading}>
              {loading ? "Loading Pose Engine..." : "Start Camera"}
            </button>
          ) : (
            <button className="pp-btn pp-ghost" onClick={stopAll}>
              Stop
            </button>
          )}
        </div>
      </div>

      {err && <div className="pp-error">Error: {err}</div>}

      <div className="pp-grid">
        <div className="pp-cam card">
          <div className="pp-cam-top">
            <span className={`pp-live ${badge.cls}`}>{badge.text}</span>
            <span className="pp-muted mini">
              Tip: Keep phone stable • Good lighting • Full body in frame
            </span>
          </div>

          <div className="pp-stage">
            <video ref={videoRef} className="pp-video" playsInline muted />
            <canvas ref={canvasRef} className="pp-canvas" />
          </div>
        </div>

        <div className="pp-side">
          <div className="card">
            <div className="pp-side-head">
              <h3>{feedback.title}</h3>
              <span className={`pp-pill ${badge.cls}`}>{badge.text}</span>
            </div>

            <div className="pp-tips">
              {feedback.tips.map((t, i) => (
                <div key={i} className="pp-tip">
                  <span className="dot" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="pp-side-head">
              <h3>Live metrics</h3>
              <span className="pp-muted mini">Angles & alignment</span>
            </div>

            <div className="pp-metrics">
              {Object.entries(feedback.metrics || {}).map(([k, v]) => (
                <div key={k} className="pp-metric">
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
              {!feedback.metrics && (
                <div className="pp-muted mini">Start camera to see live values.</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3>What this supports</h3>
            <p className="pp-muted mini" style={{ marginTop: 8 }}>
              This is designed to be <b>accurate for a few exercises</b> (squat, push-up, plank, standing).
              “All exercises posture corrector” is not realistic without a full exercise library and calibration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}