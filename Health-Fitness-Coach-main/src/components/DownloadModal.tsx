import { useState, useEffect } from 'react';
import { ModelManager, EventBus } from '@runanywhere/web';

interface Props {
    onClose: () => void;
}

export function DownloadModal({ onClose }: Props) {
    const [models, setModels] = useState(() => ModelManager.getModels());
    const [downloading, setDownloading] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);

    useEffect(() => {
        const unsub = ModelManager.onChange(() => {
            setModels(ModelManager.getModels());
        });
        return unsub;
    }, []);

    const totalSize = models.reduce((acc, m) => acc + (m.memoryRequirement ?? 0), 0);
    const downloadedCount = models.filter(m => m.status === 'downloaded' || m.status === 'loaded').length;
    const isAllDownloaded = downloadedCount === models.length;

    const downloadAll = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            // Get a fresh list of models to download
            const currentModels = ModelManager.getModels();
            const toDownload = currentModels.filter(m => m.status !== 'downloaded' && m.status !== 'loaded');

            for (const model of toDownload) {
                console.log(`[DownloadModal] Starting download for ${model.name}...`);
                await ModelManager.downloadModel(model.id);
                // After each download, the ModelManager.onChange listener will trigger a re-render
                // But we wait here to ensure full sequential completion
            }
            console.log("[DownloadModal] All requested models downloaded.");
        } catch (err) {
            console.error('[DownloadModal] Sequential download failed:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content download-modal">
                <div className="modal-header">
                    <h2>📦 Download AI Packages</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <p>For the best experience, download all AI features for offline use. This includes Chat, Vision, Voice, and Posture models (approx. {(totalSize / 1e6).toFixed(0)} MB).</p>

                    <div className="model-grid">
                        {models.map(m => (
                            <div key={m.id} className="model-item">
                                <span className="model-name">{m.name}</span>
                                <span className={`model-status status-${m.status}`}>
                                    {m.status === 'downloaded' || m.status === 'loaded' ? '✅' : '⏳'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {downloading && (
                        <div className="overall-progress">
                            <div className="progress-label">Downloading all components...</div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${(downloadedCount / models.length) * 100}%` }} />
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Maybe Later</button>
                    {!isAllDownloaded && (
                        <button
                            className="btn btn-primary"
                            onClick={downloadAll}
                            disabled={downloading}
                        >
                            {downloading ? 'Downloading...' : 'Download All Now'}
                        </button>
                    )}
                    {isAllDownloaded && (
                        <button className="btn btn-green" onClick={onClose}>Checkmark Ready!</button>
                    )}
                </div>
            </div>
        </div>
    );
}
