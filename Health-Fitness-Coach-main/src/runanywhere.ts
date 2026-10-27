











import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  ModelCategory,
  LLMFramework,
  type CompactModelDef,
} from '@runanywhere/web';

import { LlamaCPP, VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { ONNX } from '@runanywhere/web-onnx';


// @ts-ignore — Vite-specific ?worker&url query
import vlmWorkerUrl from './workers/vlm-worker?worker&url';





const MODELS: CompactModelDef[] = [
  
  {
    id: 'lfm2-350m-q4_k_m',
    name: 'LFM2 350M Q4_K_M',
    repo: 'LiquidAI/LFM2-350M-GGUF',
    files: ['LFM2-350M-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 250_000_000,
  },
  
  {
    id: 'lfm2-vl-450m-q4_0',
    name: 'LFM2-VL 450M Q4_0',
    repo: 'runanywhere/LFM2-VL-450M-GGUF',
    files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Multimodal,
    memoryRequirement: 500_000_000,
  },
  
  {
    id: 'sherpa-onnx-whisper-tiny.en',
    name: 'Whisper Tiny English (ONNX)',
    url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechRecognition,
    memoryRequirement: 105_000_000,
    artifactType: 'archive' as const,
  },
  
  {
    id: 'vits-piper-en_US-lessac-medium',
    name: 'Piper TTS US English (Lessac)',
    url: 'https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechSynthesis,
    memoryRequirement: 65_000_000,
    artifactType: 'archive' as const,
  },
  
  {
    id: 'silero-vad-v5',
    name: 'Silero VAD v5',
    url: 'https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx',
    files: ['silero_vad.onnx'],
    framework: LLMFramework.ONNX,
    modality: ModelCategory.Audio,
    memoryRequirement: 5_000_000,
  },
];





let _initPromise: Promise<void> | null = null;

 
export async function initSDK(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    
    await RunAnywhere.initialize({
      environment: SDKEnvironment.Development,
      debug: true,
    });

    
    await LlamaCPP.register();
    await ONNX.register();

    
    RunAnywhere.registerModels(MODELS);

    
    VLMWorkerBridge.shared.workerUrl = vlmWorkerUrl;
    RunAnywhere.setVLMLoader({
      get isInitialized() { return VLMWorkerBridge.shared.isInitialized; },
      init: () => VLMWorkerBridge.shared.init(),
      loadModel: (params) => VLMWorkerBridge.shared.loadModel(params),
      unloadModel: () => VLMWorkerBridge.shared.unloadModel(),
    });
  })();

  return _initPromise;
}

 
export function getAccelerationMode(): string | null {
  return LlamaCPP.isRegistered ? LlamaCPP.accelerationMode : null;
}


export { RunAnywhere, ModelManager, ModelCategory, VLMWorkerBridge };
