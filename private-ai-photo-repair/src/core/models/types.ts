import type { DeviceTier, InferenceBackend } from "../capabilities/types";

export type RetouchTask =
  | "background-removal"
  | "enhance"
  | "denoise"
  | "super-resolution"
  | "restore-old-photo"
  | "reference-guided-restore"
  | "unknown";

export interface ModelRegistryEntry {
  id: string;
  name: string;
  task: RetouchTask;
  description: string;
  modelUrl: string | null;
  quantizedModelUrl?: string | null;
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
}

export const DEFAULT_SETTINGS: AppSettings = {
  storageSaverEnabled: false,
  storageSaverMaxAgeDays: 30,
  promptModelSetupOnStart: true,
};
