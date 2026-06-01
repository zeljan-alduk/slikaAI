import type { InferenceBackend } from "../capabilities/types";
import type { ModelRegistryEntry, RetouchTask, ModelLoadProgress } from "../models/types";
import type { UserImageAsset, ReferenceImageAsset } from "../image/types";
import type { RetouchIntent } from "../prompt/promptTypes";
import type {
  ProcessingProgress,
  TileProgress,
  PipelineLogEntry,
} from "../progress/progressTypes";

export interface InferenceResult {
  taskId: string;
  taskType: RetouchTask;
  outputBlob: Blob;
  outputObjectUrl: string;
  mimeType: string;
  width: number;
  height: number;
  processingDurationMs: number;
  usedBackend: InferenceBackend;
  usedMock: boolean;
  warnings: string[];
}

export interface LoadModelOptions {
  model: ModelRegistryEntry;
  backend: InferenceBackend;
  cachedModelBlob?: Blob | null;
  signal?: AbortSignal;
  onProgress?: (progress: ModelLoadProgress) => void;
}

export interface RunOptions {
  mainImage: UserImageAsset;
  referenceImages: ReferenceImageAsset[];
  intent: RetouchIntent;
  signal?: AbortSignal;
  onProgress?: (progress: ProcessingProgress) => void;
  onTileProgress?: (progress: TileProgress) => void;
  onLog?: (entry: PipelineLogEntry) => void;
}

export interface ImageInferencePipeline {
  loadModel(options: LoadModelOptions): Promise<void>;
  unloadModel(): Promise<void>;
  run(options: RunOptions): Promise<InferenceResult>;
}

/**
 * Worker-side variant of RunOptions. The worker receives transferred
 * ImageBitmaps (via ImageData) rather than DOM File/objectUrl assets, so it
 * works with a lighter surface.
 */
export interface WorkerImageInput {
  id: string;
  imageData: ImageData;
  width: number;
  height: number;
  mimeType: string;
  fileName: string;
}

export interface WorkerReferenceInput extends WorkerImageInput {
  referenceType: ReferenceImageAsset["referenceType"];
}
