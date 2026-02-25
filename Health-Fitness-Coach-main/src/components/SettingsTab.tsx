import React, { useEffect, useMemo, useState } from "react";
import { ModelManager } from "@runanywhere/web";
import { LlamaCPP } from "@runanywhere/web-llamacpp";

type Toast = { id: string; type: "success" | "error" | "info"; title: string; message?: string };

const STORAGE_KEYS = {
  fastMode: "fitness-ai-fast-mode",
  cloudMode: "fitness-ai-cloud-mode",
  analytics: "fitness-analytics-enabled",
  localOnly: "fitness-local-only-mode",
  theme: "fitness-theme-mode", // optional if you have it
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function bytesToHuman(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function estimateLocalStorageBytes() {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) ?? "";
      total += k.length + v.length;
    }
    // UTF-16 ~2 bytes/char, rough estimate
    return total * 2;
  } catch {
    return 0;
  }
}

export function SettingsTab() {
  const [fastMode, setFastMode] = useState(() => localStorage.getItem(STORAGE_KEYS.fastMode) === "true");
  const [cloudMode, setCloudMode] = useState(() => localStorage.getItem(STORAGE_KEYS.cloudMode) !== "false"); // default true
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => localStorage.getItem(STORAGE_KEYS.analytics) !== "false");
  const [localOnlyMode, setLocalOnlyMode] = useState(() => localStorage.getItem(STORAGE_KEYS.localOnly) === "true");

  const [accelMode, setAccelMode] = useState<string | null>(null);
  const [storageBytes, setStorageBytes] = useState<number>(() => estimateLocalStorageBytes());

  const [busy, setBusy] = useState<null | "clearModels" | "resetApp">(null);

  // modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void> | void)>(null);

  // toast
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (t: Omit<Toast, "id">) => {
    const toast: Toast = { id: uid("toast"), ...t };
    setToasts((prev) => [toast, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== toast.id));
    }, 2800);
  };

  useEffect(() => {
    setAccelMode(LlamaCPP.accelerationMode);
    const id = window.setInterval(() => setStorageBytes(estimateLocalStorageBytes()), 1500);
    return () => window.clearInterval(id);
  }, []);

  // Derived policy: Local-only disables cloud processing
  useEffect(() => {
    if (localOnlyMode && cloudMode) {
      setCloudMode(false);
      localStorage.setItem(STORAGE_KEYS.cloudMode, "false");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localOnlyMode]);

  const env = useMemo(() => {
    const isSecure = window.location.protocol === "https:" || window.location.hostname === "localhost";
    return {
      origin: window.location.origin,
      secureContext: isSecure ? "Secure context" : "Not secure",
    };
  }, []);

  const openConfirm = (title: string, body: string, action: () => Promise<void> | void) => {
    setConfirmTitle(title);
    setConfirmBody(body);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmTitle("");
    setConfirmBody("");
    setConfirmAction(null);
  };

  const toggleFastMode = () => {
    const next = !fastMode;
    setFastMode(next);
    localStorage.setItem(STORAGE_KEYS.fastMode, String(next));
    addToast({ type: "info", title: "Performance updated", message: "Reload required to apply changes." });
  };

  const toggleCloudMode = () => {
    const next = !cloudMode;
    setCloudMode(next);
    localStorage.setItem(STORAGE_KEYS.cloudMode, String(next));
    addToast({
      type: "success",
      title: "Processing mode updated",
      message: next ? "Cloud processing enabled." : "Cloud processing disabled.",
    });
  };

  const toggleAnalytics = () => {
    const next = !analyticsEnabled;
    setAnalyticsEnabled(next);
    localStorage.setItem(STORAGE_KEYS.analytics, String(next));
    addToast({
      type: "success",
      title: "Privacy updated",
      message: next ? "Analytics enabled." : "Analytics disabled.",
    });
  };

  const toggleLocalOnly = () => {
    const next = !localOnlyMode;
    setLocalOnlyMode(next);
    localStorage.setItem(STORAGE_KEYS.localOnly, String(next));
    addToast({
      type: "success",
      title: "Privacy updated",
      message: next ? "Local-only mode enabled." : "Local-only mode disabled.",
    });
  };

  const reloadApp = () => window.location.reload();

  const clearModelCache = async () => {
    setBusy("clearModels");
    try {
      await ModelManager.clearAll();
      addToast({ type: "success", title: "Models cleared", message: "Local model cache removed successfully." });
      setStorageBytes(estimateLocalStorageBytes());
    } catch (e) {
      addToast({ type: "error", title: "Failed to clear models", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const resetAppSettings = async () => {
    setBusy("resetApp");
    try {
      // only remove app keys, not everything
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));

      // Optional: also clear app-specific plan/workouts keys if you use them
      // localStorage.removeItem("fitnesscoach:workouts:v3");
      // localStorage.removeItem("fitnesscoach:plan:v2");

      addToast({ type: "success", title: "Reset complete", message: "Settings restored to defaults." });
      // reload after short delay
      window.setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      addToast({ type: "error", title: "Reset failed", message: e instanceof Error ? e.message : String(e) });
      setBusy(null);
    }
  };

  return (
    <div className="st-wrap">
      {/* Toasts */}
      <div className="st-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`st-toast ${t.type}`}>
            <div className="st-toast-title">{t.title}</div>
            {t.message && <div className="st-toast-msg">{t.message}</div>}
          </div>
        ))}
      </div>

      <div className="st-head">
        <div>
          <div className="st-badge">Settings</div>
          <h2>Preferences and system controls</h2>
          <p className="st-muted">
            Configure performance, privacy, and storage. Some changes may require a reload.
          </p>
        </div>

        <div className="st-actions">
          <button className="st-btn ghost" onClick={reloadApp}>
            Reload app
          </button>
        </div>
      </div>

      <div className="st-grid">
        {/* Left column */}
        <div className="st-col">
          <div className="card">
            <div className="st-panel-head">
              <h3>Performance</h3>
              <span className="st-pill subtle">Runtime</span>
            </div>

            <div className="st-item">
              <div className="st-info">
                <div className="st-label">Fast mode</div>
                <div className="st-sub">Reduces response length for faster UI interactions.</div>
              </div>
              <button className={`st-toggle ${fastMode ? "on" : ""}`} onClick={toggleFastMode} type="button">
                <span className="dot" />
                <span className="txt">{fastMode ? "On" : "Off"}</span>
              </button>
            </div>

            <div className="st-item">
              <div className="st-info">
                <div className="st-label">Cloud processing</div>
                <div className="st-sub">Use cloud acceleration when available. Disable for offline-only usage.</div>
              </div>
              <button
                className={`st-toggle ${cloudMode ? "on" : ""}`}
                onClick={toggleCloudMode}
                type="button"
                disabled={localOnlyMode}
                title={localOnlyMode ? "Disabled because Local-only mode is enabled" : ""}
              >
                <span className="dot" />
                <span className="txt">{cloudMode ? "On" : "Off"}</span>
              </button>
            </div>

            <div className="st-item">
              <div className="st-info">
                <div className="st-label">Hardware acceleration</div>
                <div className="st-sub">Backend: {accelMode?.toUpperCase() || "Detecting..."}</div>
              </div>
              <span className="st-pill">{accelMode?.toUpperCase() || "Loading"}</span>
            </div>
          </div>

          <div className="card">
            <div className="st-panel-head">
              <h3>Privacy</h3>
              <span className="st-pill subtle">Controls</span>
            </div>

            <div className="st-item">
              <div className="st-info">
                <div className="st-label">Local-only mode</div>
                <div className="st-sub">Forces offline operation. Disables cloud processing automatically.</div>
              </div>
              <button className={`st-toggle ${localOnlyMode ? "on" : ""}`} onClick={toggleLocalOnly} type="button">
                <span className="dot" />
                <span className="txt">{localOnlyMode ? "On" : "Off"}</span>
              </button>
            </div>

            <div className="st-item">
              <div className="st-info">
                <div className="st-label">Usage analytics</div>
                <div className="st-sub">Enable telemetry to improve stability. Recommended off for privacy-first builds.</div>
              </div>
              <button className={`st-toggle ${analyticsEnabled ? "on" : ""}`} onClick={toggleAnalytics} type="button">
                <span className="dot" />
                <span className="txt">{analyticsEnabled ? "On" : "Off"}</span>
              </button>
            </div>

            <div className="st-callout">
              Privacy note: This screen demonstrates UI controls. Real analytics must be implemented explicitly in code.
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="st-col">
          <div className="card">
            <div className="st-panel-head">
              <h3>Storage</h3>
              <span className="st-pill subtle">Device</span>
            </div>

            <div className="st-kv">
              <div className="k">Estimated local usage</div>
              <div className="v">{bytesToHuman(storageBytes)}</div>
            </div>

            <div className="st-kv">
              <div className="k">Model cache</div>
              <div className="v">Managed by RunAnywhere ModelManager</div>
            </div>

            <div className="st-row" style={{ marginTop: 12 }}>
              <button
                className="st-btn danger ghost"
                disabled={busy === "clearModels"}
                onClick={() =>
                  openConfirm(
                    "Clear model cache",
                    "This will remove downloaded models from local storage. They will need to be downloaded again.",
                    clearModelCache
                  )
                }
              >
                {busy === "clearModels" ? "Clearing..." : "Clear models"}
              </button>

              <button className="st-btn ghost" onClick={() => addToast({ type: "info", title: "Tip", message: "Use Local-only mode for fully offline usage." })}>
                Storage tips
              </button>
            </div>
          </div>

          <div className="card">
            <div className="st-panel-head">
              <h3>Danger zone</h3>
              <span className="st-pill subtle">Reset</span>
            </div>

            <div className="st-muted">
              Reset will restore defaults for app settings stored on this device.
            </div>

            <div className="st-row" style={{ marginTop: 12 }}>
              <button
                className="st-btn danger"
                disabled={busy === "resetApp"}
                onClick={() =>
                  openConfirm(
                    "Reset app settings",
                    "This will reset preferences (performance, privacy, and other saved settings). This cannot be undone.",
                    resetAppSettings
                  )
                }
              >
                {busy === "resetApp" ? "Resetting..." : "Reset settings"}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="st-panel-head">
              <h3>About</h3>
              <span className="st-pill subtle">Build</span>
            </div>

            <div className="st-kv">
              <div className="k">Version</div>
              <div className="v">1.0.0</div>
            </div>
            <div className="st-kv">
              <div className="k">Environment</div>
              <div className="v">{env.secureContext}</div>
            </div>
            <div className="st-kv">
              <div className="k">Origin</div>
              <div className="v">{env.origin}</div>
            </div>

            <div className="st-muted mini" style={{ marginTop: 10 }}>
              For production, connect account settings to a backend and sync user preferences across devices.
            </div>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="st-modal" role="dialog" aria-modal="true">
          <div className="st-confirm card">
            <div className="st-confirm-title">{confirmTitle}</div>
            <div className="st-muted" style={{ marginTop: 8 }}>
              {confirmBody}
            </div>

            <div className="st-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="st-btn ghost" onClick={closeConfirm}>Cancel</button>
              <button
                className="st-btn danger"
                onClick={async () => {
                  const fn = confirmAction;
                  closeConfirm();
                  if (fn) await fn();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}