import { ModelManager, ModelCategory } from '@runanywhere/web';
import type { LoaderState } from '../hooks/useModelLoader';

interface Props {
  state: LoaderState;
  progress: number;
  error: string | null;
  onLoad: () => void;
  label: string;
  category: ModelCategory;
}

export function ModelBanner({ state, progress, error, onLoad, label, category }: Props) {
  if (state === 'ready') return null;

  // Hide banner if the model is already on disk and we are just waiting to load it
  const isDownloaded = ModelManager.getModels()
    .filter(m => m.modality === category)
    .some(m => m.status === 'downloaded' || m.status === 'loaded');

  if (isDownloaded && (state === 'idle' || state === 'loading')) {
    return null;
  }

  return (
    <div className="model-banner">
      {state === 'idle' && (
        <>
          <span>No {label} model loaded.</span>
          <button className="btn btn-sm" onClick={onLoad}>Download &amp; Load</button>
        </>
      )}
      {state === 'downloading' && (
        <>
          <span>Downloading {label} model... {(progress * 100).toFixed(0)}%</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </>
      )}
      {state === 'loading' && <span>Loading {label} model into engine...</span>}
      {state === 'error' && (
        <>
          <span className="error-text">Error: {error}</span>
          <button className="btn btn-sm" onClick={onLoad}>Retry</button>
        </>
      )}
    </div>
  );
}
