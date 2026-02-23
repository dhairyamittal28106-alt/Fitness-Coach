import { useState, useEffect } from 'react';
import { initSDK, getAccelerationMode } from './runanywhere';
import { NutritionTab } from './components/NutritionTab';
import { PostureTab } from './components/PostureTab';
import { CoachTab } from './components/CoachTab';
import { VoiceTab } from './components/VoiceTab';
import { WorkoutsTab } from './components/WorkoutsTab';
import { PlanTab } from './components/PlanTab';
import { SettingsTab } from './components/SettingsTab';
import { DownloadModal } from './components/DownloadModal';
import { ModelManager, ModelCategory } from '@runanywhere/web';
import { GlobalModelLoaderProvider } from './hooks/GlobalModelLoaderProvider';
import { useGlobalModelLoader } from './hooks/useGlobalModelLoader';

type Tab = 'nutrition' | 'posture' | 'coach' | 'voice' | 'workouts' | 'plan' | 'settings';

// Mini spinner shown on nav items when a model is loading in background
function NavLoadingDot({ category }: { category: ModelCategory }) {
  const { state } = useGlobalModelLoader(category);
  if (state !== 'downloading' && state !== 'loading') return null;
  return <span className="nav-loading-dot" />;
}

function AppShell() {
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Get loaders for all model types to show background loading indicators
  const langLoader = useGlobalModelLoader(ModelCategory.Language);
  const multiLoader = useGlobalModelLoader(ModelCategory.Multimodal);
  const sttLoader = useGlobalModelLoader(ModelCategory.SpeechRecognition);

  useEffect(() => {
    initSDK()
      .then(() => {
        setSdkReady(true);
        // Small delay to ensure ModelManager has finished storage scan
        setTimeout(() => {
          const allModels = ModelManager.getModels();
          const missing = allModels.some(m => m.status !== 'downloaded' && m.status !== 'loaded');
          if (missing) {
            setShowDownloadModal(true);
          }
        }, 500);
      })
      .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (sdkError) {
    return (
      <div className="app-loading">
        <h2>SDK Error</h2>
        <p className="error-text">{sdkError}</p>
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <h2>Loading Fitness AI...</h2>
        <p>Initializing local health assistant</p>
      </div>
    );
  }

  const accel = getAccelerationMode();

  // Show background loading status in footer
  const isAnyLoading = [langLoader, multiLoader, sttLoader].some(
    l => l.state === 'downloading' || l.state === 'loading'
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brandRow">
          <div className="brandMark" />
          <div className="brandTexts">
            <div className="brandTitle">Fitness Coach</div>
            <div className="brandSub">On-Device AI</div>
          </div>
        </div>

        <nav className="navList">
          <button className={`nav ${activeTab === 'coach' ? 'active' : ''}`} onClick={() => setActiveTab('coach')}>
            <div className="navIconWrap">
              💬
              <NavLoadingDot category={ModelCategory.Language} />
            </div>
            <div className="navLabel">Coach AI</div>
          </button>
          <button className={`nav ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>
            <div className="navIconWrap">
              🥗
              <NavLoadingDot category={ModelCategory.Multimodal} />
            </div>
            <div className="navLabel">Nutrition</div>
          </button>
          <button className={`nav ${activeTab === 'posture' ? 'active' : ''}`} onClick={() => setActiveTab('posture')}>
            <div className="navIconWrap">
              🧘
              <NavLoadingDot category={ModelCategory.Multimodal} />
            </div>
            <div className="navLabel">Posture</div>
          </button>
          <button className={`nav ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')}>
            <div className="navIconWrap">
              🎙️
              <NavLoadingDot category={ModelCategory.SpeechRecognition} />
            </div>
            <div className="navLabel">Voice</div>
          </button>
          <button className={`nav ${activeTab === 'workouts' ? 'active' : ''}`} onClick={() => setActiveTab('workouts')}>
            <div className="navIconWrap">💪</div>
            <div className="navLabel">Workouts</div>
          </button>
          <button className={`nav ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>
            <div className="navIconWrap">📅</div>
            <div className="navLabel">Plan</div>
          </button>
          <button className={`nav ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <div className="navIconWrap">⚙️</div>
            <div className="navLabel">Settings</div>
          </button>
        </nav>

        <footer className="sidebarFoot">
          <div className="sidebarHint">
            {isAnyLoading ? (
              <span>⚡ Loading AI in background...</span>
            ) : (
              <span>Running via <strong>{accel?.toUpperCase() || 'CPU'}</strong>. All processing is local and private.</span>
            )}
          </div>
        </footer>
      </aside>

      <main className="mainContent">
        <header className="topbar">
          <div className="topbarTitle">
            {activeTab === 'coach' && 'Personal Coach'}
            {activeTab === 'nutrition' && 'Nutrition Scanner'}
            {activeTab === 'posture' && 'Posture Guru'}
            {activeTab === 'voice' && 'Voice Assistant'}
            {activeTab === 'workouts' && 'Workout Routines'}
            {activeTab === 'plan' && 'Fitness Plan'}
            {activeTab === 'settings' && 'Settings'}
          </div>
          <div className="topbarPill">On-Device</div>
        </header>

        <section className="content">
          {activeTab === 'coach' && <CoachTab />}
          {activeTab === 'nutrition' && <NutritionTab />}
          {activeTab === 'posture' && <PostureTab />}
          {activeTab === 'voice' && <VoiceTab />}
          {activeTab === 'workouts' && <WorkoutsTab />}
          {activeTab === 'plan' && <PlanTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </section>

        <nav className="bottomNav">
          <button className={`bottomItem ${activeTab === 'coach' ? 'active' : ''}`} onClick={() => setActiveTab('coach')}>
            <div className="bottomIcon">
              💬
              <NavLoadingDot category={ModelCategory.Language} />
            </div>
            <div className="bottomLabel">Coach</div>
          </button>
          <button className={`bottomItem ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>
            <div className="bottomIcon">
              🥗
              <NavLoadingDot category={ModelCategory.Multimodal} />
            </div>
            <div className="bottomLabel">Diet</div>
          </button>
          <button className={`bottomItem ${activeTab === 'posture' ? 'active' : ''}`} onClick={() => setActiveTab('posture')}>
            <div className="bottomIcon">
              🧘
            </div>
            <div className="bottomLabel">Fit</div>
          </button>
          <button className={`bottomItem ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')}>
            <div className="bottomIcon">
              🎙️
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
