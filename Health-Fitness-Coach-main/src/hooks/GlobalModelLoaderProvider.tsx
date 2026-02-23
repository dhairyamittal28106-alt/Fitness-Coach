import { useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { ModelManager, ModelCategory, EventBus } from '@runanywhere/web';
import { GlobalModelLoaderContext, ModelLoaderState } from './useGlobalModelLoader';
import type { LoaderState } from './useModelLoader';

function getInitialState(category: ModelCategory): ModelLoaderState {
    return {
        state: ModelManager.getLoadedModel(category) ? 'ready' : 'idle',
        progress: 0,
        error: null,
    };
}

export function GlobalModelLoaderProvider({ children }: { children: ReactNode }) {
    const [loaders, setLoaders] = useState<Map<ModelCategory, ModelLoaderState>>(() => {
        const map = new Map<ModelCategory, ModelLoaderState>();
        // Initialize all known categories
        map.set(ModelCategory.Language, getInitialState(ModelCategory.Language));
        map.set(ModelCategory.Multimodal, getInitialState(ModelCategory.Multimodal));
        map.set(ModelCategory.SpeechRecognition, getInitialState(ModelCategory.SpeechRecognition));
        map.set(ModelCategory.SpeechSynthesis, getInitialState(ModelCategory.SpeechSynthesis));
        map.set(ModelCategory.Audio, getInitialState(ModelCategory.Audio));
        return map;
    });

    // Track which categories are currently loading to prevent double-loading
    const loadingRef = useRef<Set<ModelCategory>>(new Set());

    // Update state helper
    const updateLoader = useCallback((category: ModelCategory, patch: Partial<ModelLoaderState>) => {
        setLoaders((prev) => {
            const next = new Map(prev);
            const current = next.get(category) ?? { state: 'idle', progress: 0, error: null };
            next.set(category, { ...current, ...patch });
            return next;
        });
    }, []);

    // Listen to ModelManager changes globally so all tabs stay in sync
    useEffect(() => {
        const unsub = ModelManager.onChange(() => {
            setLoaders((prev) => {
                const next = new Map(prev);
                for (const [category] of prev) {
                    const isLoaded = !!ModelManager.getLoadedModel(category);
                    const current = next.get(category)!;
                    if (isLoaded && current.state !== 'ready') {
                        next.set(category, { ...current, state: 'ready' });
                    } else if (!isLoaded && current.state === 'ready') {
                        next.set(category, { ...current, state: 'idle' });
                    }
                }
                return next;
            });
        });
        return unsub;
    }, []);

    const ensure = useCallback(async (category: ModelCategory, coexist = false): Promise<boolean> => {
        // Already loaded
        if (ModelManager.getLoadedModel(category)) {
            updateLoader(category, { state: 'ready' });
            return true;
        }

        // Already in progress — wait for it (don't double-load)
        if (loadingRef.current.has(category)) {
            // Poll until done or error
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    const loaded = ModelManager.getLoadedModel(category);
                    if (loaded) {
                        clearInterval(interval);
                        resolve(true);
                    }
                    setLoaders((prev) => {
                        const s = prev.get(category)?.state;
                        if (s === 'error') {
                            clearInterval(interval);
                            resolve(false);
                        }
                        return prev;
                    });
                }, 500);
            });
        }

        loadingRef.current.add(category);

        try {
            const models = ModelManager.getModels().filter((m) => m.modality === category);
            if (models.length === 0) {
                updateLoader(category, { state: 'error', error: `No ${category} model registered` });
                return false;
            }

            const model = models[0];

            // Download if needed
            if (model.status !== 'downloaded' && model.status !== 'loaded') {
                updateLoader(category, { state: 'downloading', progress: 0 });

                const unsub = EventBus.shared.on('model.downloadProgress', (evt) => {
                    if (evt.modelId === model.id) {
                        updateLoader(category, { progress: evt.progress ?? 0 });
                    }
                });

                await ModelManager.downloadModel(model.id);
                unsub();
                updateLoader(category, { progress: 1 });
            }

            // Load into memory
            updateLoader(category, { state: 'loading' });
            const ok = await ModelManager.loadModel(model.id, { coexist });

            if (ok) {
                updateLoader(category, { state: 'ready' });
                return true;
            } else {
                updateLoader(category, { state: 'error', error: 'Failed to load model' });
                return false;
            }
        } catch (err) {
            updateLoader(category, { state: 'error', error: err instanceof Error ? err.message : String(err) });
            return false;
        } finally {
            loadingRef.current.delete(category);
        }
    }, [updateLoader]);

    const getLoader = useCallback((category: ModelCategory): ModelLoaderState => {
        return loaders.get(category) ?? { state: 'idle', progress: 0, error: null };
    }, [loaders]);

    return (
        <GlobalModelLoaderContext.Provider value={{ loaders, ensure, getLoader }}>
            {children}
        </GlobalModelLoaderContext.Provider>
    );
}
