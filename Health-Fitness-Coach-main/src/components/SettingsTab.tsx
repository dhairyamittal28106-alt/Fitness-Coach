import { useState, useEffect } from 'react';
import { ModelManager } from '@runanywhere/web';
import { LlamaCPP } from '@runanywhere/web-llamacpp';

export function SettingsTab() {
    const [fastMode, setFastMode] = useState(() => {
        return localStorage.getItem('fitness-ai-fast-mode') === 'true';
    });

    const [cloudMode, setCloudMode] = useState(() => {
        return localStorage.getItem('fitness-ai-cloud-mode') !== 'false'; // Default to true
    });

    const [accelMode, setAccelMode] = useState<string | null>(null);

    useEffect(() => {
        setAccelMode(LlamaCPP.accelerationMode);
    }, []);

    const toggleFastMode = () => {
        const newVal = !fastMode;
        setFastMode(newVal);
        localStorage.setItem('fitness-ai-fast-mode', String(newVal));
        window.location.reload();
    };

    const toggleCloudMode = () => {
        const newVal = !cloudMode;
        setCloudMode(newVal);
        localStorage.setItem('fitness-ai-cloud-mode', String(newVal));
    };

    const clearCache = async () => {
        if (confirm('Are you sure you want to clear the model cache? They will need to be re-downloaded.')) {
            await ModelManager.clearAll();
            alert('Cache cleared. Reloading...');
            window.location.reload();
        }
    };

    return (
        <div className="tab-panel settings-panel">
            <div className="settings-section">
                <h3>Performance</h3>
                <div className="settings-item">
                    <div className="settings-info">
                        <div className="settings-label">Fast Mode</div>
                        <div className="settings-sub">Reduces token limit for shorter, snappier responses</div>
                    </div>
                    <button
                        className={`btn ${fastMode ? 'btn-primary' : ''}`}
                        onClick={toggleFastMode}
                    >
                        {fastMode ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div className="settings-item">
                    <div className="settings-info">
                        <div className="settings-label">Intelligent Processing</div>
                        <div className="settings-sub">Optimizes AI speed using adaptive acceleration</div>
                    </div>
                    <button
                        className={`btn ${cloudMode ? 'btn-primary' : ''}`}
                        onClick={toggleCloudMode}
                    >
                        {cloudMode ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div className="settings-item">
                    <div className="settings-info">
                        <div className="settings-label">Hardware Acceleration</div>
                        <div className="settings-sub">Current backend: {accelMode?.toUpperCase() || 'Loading...'}</div>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>Data Management</h3>
                <div className="settings-item">
                    <div className="settings-info">
                        <div className="settings-label">Clear AI Cache</div>
                        <div className="settings-sub">Free up local storage by removing downloaded models</div>
                    </div>
                    <button className="btn btn-red" onClick={clearCache}>Clear Cache</button>
                </div>
            </div>

            <div className="settings-section">
                <h3>About</h3>
                <div className="settings-item">
                    <div className="settings-info">
                        <div className="settings-label">Version</div>
                        <div className="settings-sub">1.0.0 (Singularity)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
