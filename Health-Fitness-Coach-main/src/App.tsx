import React, { useEffect, useMemo, useState } from "react";
import { initSDK, getAccelerationMode } from "./runanywhere";
import { NutritionTab } from "./components/NutritionTab";
import { PostureTab } from "./components/PostureTab";
import { CoachTab } from "./components/CoachTab";
import { VoiceTab } from "./components/VoiceTab";
import { WorkoutsTab } from "./components/WorkoutsTab";
import { PlanTab } from "./components/PlanTab";
import { SettingsTab } from "./components/SettingsTab";
import { DownloadModal } from "./components/DownloadModal";
import { ModelManager, ModelCategory } from "@runanywhere/web";
import { GlobalModelLoaderProvider } from "./hooks/GlobalModelLoaderProvider";
import { useGlobalModelLoader } from "./hooks/useGlobalModelLoader";

type Tab = "nutrition" | "posture" | "coach" | "voice" | "workouts" | "plan" | "settings";

/* ----------------------------- Icons (no libs) ---------------------------- */

function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3c5.1 0 9 3.6 9 8c0 4.4-3.9 8-9 8c-1.1 0-2.2-.2-3.2-.5L4 21l1.6-3.9C4.6 15.8 3 13.9 3 11c0-4.4 3.9-8 9-8Zm-5 8h10v2H7v-2Zm0-4h10v2H7V7Z"
      />
    </svg>
  );
}
function IconFood() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 3h2v8a2 2 0 0 0 2 2v8H6v-8a4 4 0 0 1-2-3.5V3Zm7 0h2v18h-2V3Zm5 0h2v6a3 3 0 0 1-2 2.8V21h-2V11.8A3 3 0 0 1 16 9V3Z"
      />
    </svg>
  );
}
function IconPosture() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a2 2 0 1 1 0 4a2 2 0 0 1 0-4Zm-1 6h2v3.2l2.3 2.3l-1.4 1.4L11 12V8Zm-4.5 2.5l1.4 1.4L6.3 13.5l-1.4-1.4L6.5 10.5Zm11 0l1.6 1.6l-1.4 1.4l-1.6-1.6l1.4-1.4ZM8 22v-2h8v2H8Z"
      />
    </svg>
  );
}
function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm7-3a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2Z"
      />
    </svg>
  );
}
function IconDumbbell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21 10v4h-2v2h-3v-2H8v2H5v-2H3v-4h2V8h3v2h8V8h3v2h2ZM7 10H6v4h1v-4Zm12 0h-1v4h1v-4Z"
      />
    </svg>
  );
}
function IconPlan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm13 6H6v12h14V8ZM8 10h4v4H8v-4Zm6 0h4v2h-4v-2Zm0 4h4v2h-4v-2Z"
      />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.5.42h3.8c.25 0 .46-.18.5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.21.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
      />
    </svg>
  );
}

/* -------------------------- Background loading dot ------------------------- */

function NavLoadingDot({ category }: { category: ModelCategory }) {
  const { state } = useGlobalModelLoader(category);
  if (state !== "downloading" && state !== "loading") return null;
  return <span className="nav-loading-dot" aria-hidden="true" />;
}

/* --------------------------------- Shell --------------------------------- */

function AppShell() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("coach");
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // loaders for background indicators
  const langLoader = useGlobalModelLoader(ModelCategory.Language);
  const multiLoader = useGlobalModelLoader(ModelCategory.Multimodal);
  const sttLoader = useGlobalModelLoader(ModelCategory.SpeechRecognition);

  useEffect(() => {
    initSDK()
      .then(() => {
        setSdkReady(true);

        setTimeout(() => {
          const allModels = ModelManager.getModels();
          const missing = allModels.some((m) => m.status !== "downloaded" && m.status !== "loaded");
          if (missing) setShowDownloadModal(true);
        }, 500);
      })
      .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
  }, []);

  const accel = useMemo(() => getAccelerationMode(), []);
  const isAnyLoading = [langLoader, multiLoader, sttLoader].some(
    (l) => l.state === "downloading" || l.state === "loading"
  );

  const title = useMemo(() => {
    switch (activeTab) {
      case "coach":
        return "Coach";
      case "nutrition":
        return "Nutrition";
      case "posture":
        return "Posture";
      case "voice":
        return "Voice";
      case "workouts":
        return "Workouts";
      case "plan":
        return "Plan";
      case "settings":
        return "Settings";
      default:
        return "Fitness Coach";
    }
  }, [activeTab]);

  if (sdkError) {
    return (
      <div className="app-state">
        <div className="state-card">
          <div className="state-title">Initialization failed</div>
          <div className="state-sub">The SDK could not be started on this device.</div>
          <div className="state-error">{sdkError}</div>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="app-state">
        <div className="state-card">
          <div className="spinner" />
          <div className="state-title">Starting services</div>
          <div className="state-sub">Preparing local runtime and scanning on-device storage.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brandRow">
          <div className="brandMark" />
          <div className="brandTexts">
            <div className="brandTitle">Fitness Coach</div>
            <div className="brandSub">Privacy-first, on-device</div>
          </div>
        </div>

        <nav className="navList" aria-label="Primary navigation">
          <button className={`nav ${activeTab === "coach" ? "active" : ""}`} onClick={() => setActiveTab("coach")}>
            <div className="navIconWrap">
              <IconChat />
              <NavLoadingDot category={ModelCategory.Language} />
            </div>
            <div className="navLabel">Coach</div>
          </button>

          <button className={`nav ${activeTab === "nutrition" ? "active" : ""}`} onClick={() => setActiveTab("nutrition")}>
            <div className="navIconWrap">
              <IconFood />
              <NavLoadingDot category={ModelCategory.Multimodal} />
            </div>
            <div className="navLabel">Nutrition</div>
          </button>

          <button className={`nav ${activeTab === "posture" ? "active" : ""}`} onClick={() => setActiveTab("posture")}>
            <div className="navIconWrap">
              <IconPosture />
              <NavLoadingDot category={ModelCategory.Multimodal} />
            </div>
            <div className="navLabel">Posture</div>
          </button>

          <button className={`nav ${activeTab === "voice" ? "active" : ""}`} onClick={() => setActiveTab("voice")}>
            <div className="navIconWrap">
              <IconMic />
              <NavLoadingDot category={ModelCategory.SpeechRecognition} />
            </div>
            <div className="navLabel">Voice</div>
          </button>

          <button className={`nav ${activeTab === "workouts" ? "active" : ""}`} onClick={() => setActiveTab("workouts")}>
            <div className="navIconWrap">
              <IconDumbbell />
            </div>
            <div className="navLabel">Workouts</div>
          </button>

          <button className={`nav ${activeTab === "plan" ? "active" : ""}`} onClick={() => setActiveTab("plan")}>
            <div className="navIconWrap">
              <IconPlan />
            </div>
            <div className="navLabel">Plan</div>
          </button>

          <button className={`nav ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
            <div className="navIconWrap">
              <IconSettings />
            </div>
            <div className="navLabel">Settings</div>
          </button>
        </nav>

        <footer className="sidebarFoot">
          <div className="sidebarHint">
            {isAnyLoading ? (
              <span>Background loading is in progress.</span>
            ) : (
              <span>
                Engine: <strong>{accel?.toUpperCase() || "CPU"}</strong>. Local processing with on-device privacy.
              </span>
            )}
          </div>
        </footer>
      </aside>

      <main className="mainContent">
        <header className="topbar">
          <div className="topbarTitle">{title}</div>
          <div className="topbarPill">On-device</div>
        </header>

        <section className="content">
          {activeTab === "coach" && <CoachTab />}
          {activeTab === "nutrition" && <NutritionTab />}
          {activeTab === "posture" && <PostureTab />}
          {activeTab === "voice" && <VoiceTab />}
          {activeTab === "workouts" && <WorkoutsTab />}
          {activeTab === "plan" && <PlanTab />}
          {activeTab === "settings" && <SettingsTab />}
        </section>

        <nav className="bottomNav" aria-label="Mobile navigation">
          <button className={`bottomItem ${activeTab === "coach" ? "active" : ""}`} onClick={() => setActiveTab("coach")}>
            <div className="bottomIcon">
              <IconChat />
              <NavLoadingDot category={ModelCategory.Language} />
            </div>
            <div className="bottomLabel">Coach</div>
          </button>

          <button className={`bottomItem ${activeTab === "nutrition" ? "active" : ""}`} onClick={() => setActiveTab("nutrition")}>
            <div className="bottomIcon">
              <IconFood />
              <NavLoadingDot category={ModelCategory.Multimodal} />
            </div>
            <div className="bottomLabel">Nutrition</div>
          </button>

          <button className={`bottomItem ${activeTab === "posture" ? "active" : ""}`} onClick={() => setActiveTab("posture")}>
            <div className="bottomIcon">
              <IconPosture />
            </div>
            <div className="bottomLabel">Posture</div>
          </button>

          <button className={`bottomItem ${activeTab === "voice" ? "active" : ""}`} onClick={() => setActiveTab("voice")}>
            <div className="bottomIcon">
              <IconMic />
              <NavLoadingDot category={ModelCategory.SpeechRecognition} />
            </div>
            <div className="bottomLabel">Voice</div>
          </button>
        </nav>
      </main>

      {showDownloadModal && <DownloadModal onClose={() => setShowDownloadModal(false)} />}
    </div>
  );
}

export function App() {
  return (
    <GlobalModelLoaderProvider>
      <AppShell />
    </GlobalModelLoaderProvider>
  );
}