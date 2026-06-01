import type { InferenceBackend } from "../core/capabilities/types";
import type { ModelRegistryEntry, InferenceEngine } from "../core/models/types";
import type { RetouchIntent } from "../core/prompt/promptTypes";
import type { UserImageAsset, ReferenceImageAsset } from "../core/image/types";
import type {
  UserImageAssetTransfer,
  ReferenceImageAssetTransfer,
} from "../core/image/types";
import type { InferenceResult } from "../core/inference/types";
import type {
  ProcessingProgress,
  TileProgress,
  PipelineLogEntry,
} from "../core/progress/progressTypes";
import type {
  WorkerOutboundMessage,
  StartInferenceMessage,
} from "./workerMessages";

export interface RunInferenceCallbacks {
  onProgress: (p: ProcessingProgress) => void;
  onTileProgress: (p: TileProgress) => void;
  onLog: (e: PipelineLogEntry) => void;
}

export interface RunInferenceHandle {
  taskId: string;
  result: Promise<InferenceResult>;
  cancel: () => void;
}

export interface RunInferenceParams {
  taskId: string;
  mainImage: UserImageAsset;
  referenceImages: ReferenceImageAsset[];
  intent: RetouchIntent;
  model: ModelRegistryEntry;
  backend: InferenceBackend;
  engine: InferenceEngine;
  useMock: boolean;
  maxWorkingSize: number;
}

export class ProcessingCancelledError extends Error {
  constructor() {
    super("Processing cancelled.");
    this.name = "ProcessingCancelledError";
  }
}

/**
 * Decode the file to an ImageBitmap, downscaling at decode time so the worker
 * never receives a buffer larger than `maxSize` on its longest side. This keeps
 * peak memory low and avoids OOM crashes with large phone photos.
 */
async function toTransfer(
  asset: UserImageAsset,
  maxSize: number,
): Promise<{ transfer: UserImageAssetTransfer; bitmap: ImageBitmap }> {
  const longest = Math.max(asset.width, asset.height);
  let bitmap: ImageBitmap;
  if (longest > maxSize) {
    const scale = maxSize / longest;
    bitmap = await createImageBitmap(asset.file, {
      resizeWidth: Math.max(1, Math.round(asset.width * scale)),
      resizeHeight: Math.max(1, Math.round(asset.height * scale)),
      resizeQuality: "high",
    });
  } else {
    bitmap = await createImageBitmap(asset.file);
  }
  return {
    transfer: {
      id: asset.id,
      role: asset.role,
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      fileName: asset.file.name,
    },
    bitmap,
  };
}

/**
 * Run inference in a dedicated module worker. ImageBitmaps are transferred to
 * avoid copying large pixel buffers.
 */
export function runInferenceInWorker(
  params: RunInferenceParams,
  cb: RunInferenceCallbacks,
): RunInferenceHandle {
  const worker = new Worker(new URL("./inference.worker.ts", import.meta.url), {
    type: "module",
  });

  const result = new Promise<InferenceResult>((resolve, reject) => {
    void (async () => {
      try {
        // References are only analysed (quality/face heuristics), so cap them smaller.
        const refCap = Math.min(params.maxWorkingSize, 768);
        const main = await toTransfer(params.mainImage, params.maxWorkingSize);
        const refs: { transfer: ReferenceImageAssetTransfer; bitmap: ImageBitmap }[] =
          await Promise.all(
            params.referenceImages.map(async (ref) => {
              const t = await toTransfer(ref, refCap);
              return {
                transfer: { ...t.transfer, role: "reference", referenceType: ref.referenceType },
                bitmap: t.bitmap,
              };
            }),
          );

        worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
          const msg = event.data;
          switch (msg.type) {
            case "processing-progress":
              cb.onProgress(msg.payload);
              break;
            case "tile-progress":
              cb.onTileProgress(msg.payload);
              break;
            case "log":
              cb.onLog(msg.payload);
              break;
            case "completed": {
              const p = msg.payload;
              const outputObjectUrl = URL.createObjectURL(p.outputBlob);
              resolve({
                taskId: params.taskId,
                taskType: p.taskType,
                outputBlob: p.outputBlob,
                outputObjectUrl,
                mimeType: p.mimeType,
                width: p.width,
                height: p.height,
                processingDurationMs: p.processingDurationMs,
                usedBackend: p.usedBackend,
                usedMock: p.usedMock,
                warnings: p.warnings,
                // imageData is attached for re-export; see resultImageData map.
              });
              attachImageData(params.taskId, p.imageData);
              worker.terminate();
              break;
            }
            case "cancelled":
              reject(new ProcessingCancelledError());
              worker.terminate();
              break;
            case "error":
              reject(new Error(msg.error));
              worker.terminate();
              break;
          }
        };

        worker.onerror = (event) => {
          reject(new Error(event.message || "Inference worker crashed."));
          worker.terminate();
        };

        const message: StartInferenceMessage = {
          type: "start-inference",
          payload: {
            taskId: params.taskId,
            mainImage: main.transfer,
            referenceImages: refs.map((r) => r.transfer),
            intent: params.intent,
            model: params.model,
            backend: params.backend,
            engine: params.engine,
            useMock: params.useMock,
            maxWorkingSize: params.maxWorkingSize,
          },
        };
        const transfer: Transferable[] = [main.bitmap, ...refs.map((r) => r.bitmap)];
        worker.postMessage(message, transfer);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        worker.terminate();
      }
    })();
  });

  return {
    taskId: params.taskId,
    result,
    cancel: () => {
      worker.postMessage({ type: "cancel", taskId: params.taskId });
    },
  };
}

// Store the raw output ImageData by taskId so the export panel can re-encode to
// other formats without re-running the pipeline.
const resultImageData = new Map<string, ImageData>();

function attachImageData(taskId: string, data: ImageData): void {
  resultImageData.set(taskId, data);
}

export function getResultImageData(taskId: string): ImageData | null {
  return resultImageData.get(taskId) ?? null;
}

export function clearResultImageData(taskId: string): void {
  resultImageData.delete(taskId);
}
