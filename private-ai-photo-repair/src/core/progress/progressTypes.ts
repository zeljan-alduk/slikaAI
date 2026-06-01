import type { RetouchTask, DownloadProgress, ModelLoadProgress } from "../models/types";

export type ProcessingStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  status: ProcessingStepStatus;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  weight: number;
}

export type ProcessingStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ProcessingProgress {
  taskId: string;
  taskType: RetouchTask;
  status: ProcessingStatus;
  overallPercentage: number;
  currentStepId: string | null;
  currentMessage: string;
  steps: ProcessingStep[];
  startedAt: number | null;
  completedAt: number | null;
  totalDurationMs: number | null;
  error?: string;
}

export interface TileProgress {
  totalTiles: number;
  completedTiles: number;
  currentTileIndex: number;
  tilePercentage: number;
  overallTilePercentage: number;
  estimatedSecondsRemaining: number | null;
  message: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogSource =
  | "capability-detection"
  | "model-cache"
  | "model-loader"
  | "prompt-parser"
  | "image-preprocessor"
  | "reference-image-processor"
  | "inference-worker"
  | "postprocessor"
  | "export";

export interface PipelineLogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: Record<string, unknown>;
}

export type AppProgressEvent =
  | { type: "download-progress"; payload: DownloadProgress }
  | { type: "model-load-progress"; payload: ModelLoadProgress }
  | { type: "processing-progress"; payload: ProcessingProgress }
  | { type: "tile-progress"; payload: TileProgress }
  | { type: "log"; payload: PipelineLogEntry };
