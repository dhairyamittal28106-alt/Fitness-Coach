import { useState, useRef, useEffect, useCallback } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { VideoCapture, VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { useGlobalModelLoader } from '../hooks/useGlobalModelLoader';
import { ModelBanner } from './ModelBanner';
import { GeminiService } from '../services/GeminiService';

const LIVE_INTERVAL_MS = 3000;
const SINGLE_MAX_TOKENS = 120;
const CAPTURE_DIM = 256;

interface VisionResult {
    text: string;
    totalMs: number;
}

export function NutritionTab() {
    const loader = useGlobalModelLoader(ModelCategory.Multimodal);
    const [cameraActive, setCameraActive] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<VisionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('Analyze the nutritional content of this food. Estimate calories, macros, and give health advice.');

    // Pre-load model on mount
    useEffect(() => {
        loader.ensure();
    }, []);

    const videoMountRef = useRef<HTMLDivElement>(null);
    const captureRef = useRef<VideoCapture | null>(null);
    const processingRef = useRef(false);

    processingRef.current = processing;

    const startCamera = useCallback(async () => {
        if (captureRef.current?.isCapturing) return;
        setError(null);
        try {
            const cam = new VideoCapture({ facingMode: 'environment' });
            await cam.start();
            captureRef.current = cam;
            const mount = videoMountRef.current;
            if (mount) {
                const el = cam.videoElement;
                el.style.width = '100%';
                el.style.borderRadius = '12px';
                mount.appendChild(el);
            }
            setCameraActive(true);
        } catch (err) {
            setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, []);

    useEffect(() => {
        return () => {
            const cam = captureRef.current;
            if (cam) {
                cam.stop();
                cam.videoElement.parentNode?.removeChild(cam.videoElement);
                captureRef.current = null;
            }
        };
    }, []);

    const analyze = useCallback(async () => {
        const cam = captureRef.current;
        if (!cam?.isCapturing || processingRef.current) return;

        if (loader.state !== 'ready') {
            const ok = await loader.ensure();
            if (!ok) return;
        }

        const frame = cam.captureFrame(CAPTURE_DIM);
        if (!frame) return;

        setProcessing(true);
        processingRef.current = true;
        setError(null);
        const t0 = performance.now();

        const isCloudEnabled = localStorage.getItem('fitness-ai-cloud-mode') !== 'false';

        try {
            if (isCloudEnabled && GeminiService.isSupported) {
                console.log("[NutritionTab] Intelligent Cloud Acceleration Active...");
                const text = await GeminiService.vision(prompt, frame.rgbPixels, frame.width, frame.height);
                setResult({ text, totalMs: performance.now() - t0 });
                setProcessing(false);
                processingRef.current = false;
                return;
            }
        } catch (err) {
            console.warn("Cloud processing failed, falling back to local:", err);
        }

        try {
            const bridge = VLMWorkerBridge.shared;
            const res = await bridge.process(
                frame.rgbPixels,
                frame.width,
                frame.height,
                prompt,
                { maxTokens: SINGLE_MAX_TOKENS, temperature: 0.6 },
            );
            setResult({ text: res.text, totalMs: performance.now() - t0 });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setProcessing(false);
            processingRef.current = false;
        }
    }, [loader, prompt]);

    return (
        <div className="tab-panel nutrition-panel">
            <ModelBanner
                state={loader.state}
                progress={loader.progress}
                error={loader.error}
                onLoad={loader.ensure}
                label="Nutrition AI"
                category={ModelCategory.Multimodal}
            />

            <div className="vision-camera">
                {!cameraActive && (
                    <div className="empty-state">
                        <h3>🥗 Nutrition Scanner</h3>
                        <p>Point at your meal to analyze</p>
                    </div>
                )}
                <div ref={videoMountRef} />
            </div>

            <div className="vision-actions">
                {!cameraActive ? (
                    <button className="btn btn-primary" onClick={startCamera}>Start Scanner</button>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={analyze}
                        disabled={processing}
                    >
                        {processing ? 'Analyzing Meal...' : 'Analyze Food'}
                    </button>
                )}
            </div>

            {error && <div className="vision-result"><span className="error-text">{error}</span></div>}

            {result && (
                <div className="vision-result">
                    <h4>Nutrition Analysis</h4>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{result.text}</p>
                    <div className="message-stats">{(result.totalMs / 1000).toFixed(1)}s</div>
                </div>
            )}
        </div>
    );
}
