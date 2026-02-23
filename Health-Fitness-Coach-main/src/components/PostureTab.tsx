import { useState, useRef, useEffect, useCallback } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { VideoCapture, VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { useGlobalModelLoader } from '../hooks/useGlobalModelLoader';
import { ModelBanner } from './ModelBanner';
import { GeminiService } from '../services/GeminiService';

const LIVE_INTERVAL_MS = 2500;
const LIVE_MAX_TOKENS = 40;
const CAPTURE_DIM = 256;

interface VisionResult {
    text: string;
    totalMs: number;
}

export function PostureTab() {
    const loader = useGlobalModelLoader(ModelCategory.Multimodal);
    const [cameraActive, setCameraActive] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [liveMode, setLiveMode] = useState(false);
    const [result, setResult] = useState<VisionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('Check my posture. Are my shoulders level? Is my back straight? Give 1 quick correction.');

    // Pre-load model on mount
    useEffect(() => {
        loader.ensure();
    }, []);

    const videoMountRef = useRef<HTMLDivElement>(null);
    const captureRef = useRef<VideoCapture | null>(null);
    const processingRef = useRef(false);
    const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const liveModeRef = useRef(false);

    processingRef.current = processing;
    liveModeRef.current = liveMode;

    const startCamera = useCallback(async () => {
        if (captureRef.current?.isCapturing) return;
        setError(null);
        try {
            const cam = new VideoCapture({ facingMode: 'user' }); // Use front camera for posture
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
            if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
            const cam = captureRef.current;
            if (cam) {
                cam.stop();
                cam.videoElement.parentNode?.removeChild(cam.videoElement);
                captureRef.current = null;
            }
        };
    }, []);

    const checkPosture = useCallback(async () => {
        if (processingRef.current) return;
        const cam = captureRef.current;
        if (!cam?.isCapturing) return;

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
                console.log("[PostureTab] Intelligent Cloud Acceleration Active...");
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
            const res = await VLMWorkerBridge.shared.process(
                frame.rgbPixels,
                frame.width,
                frame.height,
                prompt,
                { maxTokens: LIVE_MAX_TOKENS, temperature: 0.4 },
            );
            setResult({ text: res.text, totalMs: performance.now() - t0 });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            if (liveModeRef.current) stopLive();
        } finally {
            setProcessing(false);
            processingRef.current = false;
        }
    }, [loader, prompt]);

    const startLive = useCallback(async () => {
        if (!captureRef.current?.isCapturing) await startCamera();
        setLiveMode(true);
        liveModeRef.current = true;
        checkPosture();
        liveIntervalRef.current = setInterval(() => {
            if (!processingRef.current && liveModeRef.current) checkPosture();
        }, LIVE_INTERVAL_MS);
    }, [startCamera, checkPosture]);

    const stopLive = useCallback(() => {
        setLiveMode(false);
        liveModeRef.current = false;
        if (liveIntervalRef.current) {
            clearInterval(liveIntervalRef.current);
            liveIntervalRef.current = null;
        }
    }, []);

    const toggleLive = () => liveMode ? stopLive() : startLive();

    return (
        <div className="tab-panel posture-panel">
            <ModelBanner
                state={loader.state}
                progress={loader.progress}
                error={loader.error}
                onLoad={loader.ensure}
                label="Posture AI"
                category={ModelCategory.Multimodal}
            />

            <div className="vision-camera">
                {!cameraActive && (
                    <div className="empty-state">
                        <h3>🧘 Posture Guru</h3>
                        <p>Prop your phone up and check your form</p>
                    </div>
                )}
                <div ref={videoMountRef} />
            </div>

            <div className="vision-actions">
                {!cameraActive ? (
                    <button className="btn btn-primary" onClick={startCamera}>Start Camera</button>
                ) : (
                    <button
                        className={`btn ${liveMode ? 'btn-live-active' : ''}`}
                        onClick={toggleLive}
                    >
                        {liveMode ? '⏹ Stop Live Check' : '▶ Start Live Check'}
                    </button>
                )}
            </div>

            {result && (
                <div className="vision-result">
                    {liveMode && <span className="live-badge">MONITORING</span>}
                    <h4>Feedback</h4>
                    <p>{result.text}</p>
                </div>
            )}
        </div>
    );
}
