import { createContext, useContext } from 'react';
import { ModelCategory } from '@runanywhere/web';
import type { LoaderState } from './useModelLoader';

export interface ModelLoaderState {
    state: LoaderState;
    progress: number;
    error: string | null;
}

export interface GlobalModelLoaderContextType {
    loaders: Map<ModelCategory, ModelLoaderState>;
    ensure: (category: ModelCategory, coexist?: boolean) => Promise<boolean>;
    getLoader: (category: ModelCategory) => ModelLoaderState;
}

export const GlobalModelLoaderContext = createContext<GlobalModelLoaderContextType | null>(null);

export function useGlobalModelLoader(category: ModelCategory): ModelLoaderState & { category: ModelCategory; ensure: () => Promise<boolean> } {
    const ctx = useContext(GlobalModelLoaderContext);
    if (!ctx) throw new Error('useGlobalModelLoader must be used within GlobalModelLoaderProvider');

    const loaderState = ctx.getLoader(category);
    return {
        ...loaderState,
        category,
        ensure: () => ctx.ensure(category),
    };
}
