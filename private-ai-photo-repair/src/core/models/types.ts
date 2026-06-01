import type { DeviceTier, InferenceBackend } from "../capabilities/types";

export type RetouchTask =
  | "background-removal"
  | "enhance"
  | "denoise"
  | "super-resolution"
  | "restore-old-photo"
  | "reference-guided-restore"
  | "unknown";

export type InferenceEngine = "onnx" | "transformers" | "mock";

export interface ModelRegistryEntry {
  id: string;
  name: string;
  task: RetouchTask;
  description: string;
  modelUrl: string | null;
  quantizedModelUrl?: string | null;
  /**
   * Hugging Face model id for the Transformers.js engine. When set (and the
   * device supports a real backend), the task runs this real model. Downloaded
   * on first use and cached by the browser (Cache Storage).
   */
  transformersModelId?: string | null;
  /**
   * Optional lighter/faster Transformers.js model used in "fast" quality mode.
   * Falls back to transformersModelId when absent.
   */
  fastTransformersModelId?: string | null;
  version: string;
  estimatedSizeMb: number;
  expectedInputSize: {
    width: number;
    height: number;
  };
  minimumTier: DeviceTier;
  preferredBackend: InferenceBackend;
  supportsTiling: boolean;
  supportsReferenceImages: boolean;
  hashSha256?: string;
  enabled: boolean;
  mockAvailable: boolean;
}

export interface CachedModelInfo {
  modelId: string;
  name: string;
  version: string;
  sizeBytes: number;
  cachedAt: number;
  lastUsedAt: number | null;
  hashSha256?: string;
  storageKey: string;
}

export type DownloadStatus =
  | "idle"
  | "checking-cache"
  | "downloading"
  | "validating"
  | "caching"
  | "ready"
  | "failed"
  | "cancelled";

export interface DownloadProgress {
  modelId: string;
  status: DownloadStatus;
  downloadedBytes: number;
  totalBytes: number | null;
  percentage: number | null;
  speedBytesPerSecond: number;
  averageSpeedBytesPerSecond: number;
  estimatedSecondsRemaining: number | null;
  startedAt: number | null;
  lastUpdatedAt: number | null;
  message: string;
  error?: string;
}

export type ModelLoadStatus =
  | "idle"
  | "loading-model-file"
  | "initializing-runtime"
  | "selecting-backend"
  | "creating-session"
  | "warming-up"
  | "ready"
  | "failed";

export interface ModelLoadProgress {
  modelId: string;
  status: ModelLoadStatus;
  percentage: number | null;
  message: string;
  backend: InferenceBackend;
  error?: string;
}

export interface ModelCacheManager {
  isModelCached(modelId: string): Promise<boolean>;
  getCachedModelInfo(modelId: string): Promise<CachedModelInfo | null>;
  downloadAndCacheModel(
    model: ModelRegistryEntry,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: DownloadProgress) => void;
    },
  ): Promise<CachedModelInfo>;
  getModelBlob(modelId: string): Promise<Blob | null>;
  markModelUsed(modelId: string): Promise<void>;
  deleteModel(modelId: string): Promise<void>;
  deleteAllModels(): Promise<void>;
  listCachedModels(): Promise<CachedModelInfo[]>;
}

/** User-tunable, non-binary settings persisted in IndexedDB (never localStorage). */
export interface AppSettings {
  storageSaverEnabled: boolean;
  /** Models unused for this many days are eligible for auto-removal. */
  storageSaverMaxAgeDays: number;
  /** Whether to offer the "set up AI models" prompt on startup. */
  promptModelSetupOnStart: boolean;
  /**
   * Opt-in to the WebGPU backend. Off by default because the WebGPU execution
   * path can crash some browsers (Chrome/Opera) on certain models; the reliable
   * WebAssembly (CPU) backend is used unless this is explicitly enabled.
   */
  preferWebGpu: boolean;
  /**
   * "fast" uses a lighter model (quicker, especially on CPU); "quality" uses the
   * heavier model for more detail. Defaults to "fast" since CPU is the default.
   */
  qualityMode: QualityMode;
}

export type QualityMode = "fast" | "quality";

export const DEFAULT_SETTINGS: AppSettings = {
  storageSaverEnabled: false,
  storageSaverMaxAgeDays: 30,
  promptModelSetupOnStart: true,
  preferWebGpu: false,
  qualityMode: "fast",
};
