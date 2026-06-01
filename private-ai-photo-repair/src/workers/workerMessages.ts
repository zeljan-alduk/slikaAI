import type { InferenceBackend } from "../core/capabilities/types";
import type { ModelRegistryEntry, RetouchTask, InferenceEngine } from "../core/models/types";
import type { RetouchIntent } from "../core/prompt/promptTypes";
import type {
  UserImageAssetTransfer,
  ReferenceImageAssetTransfer,
} from "../core/image/types";
import type {
  ProcessingProgress,
  TileProgress,
  PipelineLogEntry,
} from "../core/progress/progressTypes";

export interface StartInferenceMessage {
  type: "start-inference";
  payload: {
    taskId: string;
    mainImage: UserImageAssetTransfer;
    referenceImages: ReferenceImageAssetTransfer[];
    intent: RetouchIntent;
    model: ModelRegistryEntry;
    backend: InferenceBackend;
    engine: InferenceEngine;
    useMock: boolean;
    maxWorkingSize: number;
  };
}

export interface CancelMessage {
  type: "cancel";
  taskId: string;
}

export type WorkerInboundMessage = StartInferenceMessage | CancelMessage;

export interface ProcessingProgressMessage {
  type: "processing-progress";
  taskId: string;
  payload: ProcessingProgress;
}

export interface TileProgressMessage {
  type: "tile-progress";
  taskId: string;
  payload: TileProgress;
}

export interface LogMessage {
  type: "log";
  taskId: string;
  payload: PipelineLogEntry;
}

export interface CompletedMessage {
  type: "completed";
  taskId: string;
  payload: {
    taskType: RetouchTask;
    outputBlob: Blob;
    imageData: ImageData;
    mimeType: string;
    width: number;
    height: number;
    processingDurationMs: number;
    usedBackend: InferenceBackend;
    usedMock: boolean;
    warnings: string[];
  };
}

export interface ErrorMessage {
  type: "error";
  taskId: string;
  error: string;
}

export interface CancelledMessage {
  type: "cancelled";
  taskId: string;
}

export type WorkerOutboundMessage =
  | ProcessingProgressMessage
  | TileProgressMessage
  | LogMessage
  | CompletedMessage
  | ErrorMessage
  | CancelledMessage;
