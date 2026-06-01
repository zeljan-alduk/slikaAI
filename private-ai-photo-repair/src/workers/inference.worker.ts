/// <reference lib="webworker" />
import type {
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "./workerMessages";
import type {
  WorkerImageInput,
  WorkerReferenceInput,
} from "../core/inference/types";
import { imageDataFromBitmap } from "../core/image/canvasUtils";
import { runPipeline } from "../core/inference/ImageInferencePipeline";
import { CancelledError } from "../core/inference/MockPipelines";
import { preloadTransformersTask } from "../core/inference/TransformersPipeline";
import { formatBytes } from "../core/progress/formatters";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const controllers = new Map<string, AbortController>();

function post(message: WorkerOutboundMessage, transfer?: Transferable[]): void {
  if (transfer) ctx.postMessage(message, transfer);
  else ctx.postMessage(message);
}

ctx.addEventListener("message", (event: MessageEvent<WorkerInboundMessage>) => {
  const data = event.data;
  if (data.type === "cancel") {
    controllers.get(data.taskId)?.abort();
    return;
  }
  if (data.type === "start-inference") {
    void handleStart(data.payload);
    return;
  }
  if (data.type === "prefetch-model") {
    void handlePrefetch(data.payload);
  }
});

async function handlePrefetch(
  payload: import("./workerMessages").PrefetchModelMessage["payload"],
): Promise<void> {
  const { taskId, model, backend } = payload;
  const device = backend === "webgpu" ? "webgpu" : "wasm";
  const files = new Map<string, { loaded: number; total: number }>();
  let lastEmit = 0;
  const report = (force: boolean): void => {
    const now = Date.now();
    if (!force && now - lastEmit < 120) return;
    lastEmit = now;
    let loaded = 0;
    let total = 0;
    for (const v of files.values()) {
      loaded += v.loaded;
      total += v.total;
    }
    const percentage = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
    post({
      type: "model-load",
      taskId,
      payload: {
        modelId: model.id,
        status: "loading-model-file",
        percentage,
        message:
          total > 0
            ? `Downloading model… ${formatBytes(loaded)} / ${formatBytes(total)}`
            : "Loading model…",
        backend: device,
      },
    });
  };
  try {
    if (!model.transformersModelId) {
      throw new Error("This model has no Transformers.js id to prefetch.");
    }
    await preloadTransformersTask(model.task, model.transformersModelId, {
      device,
      progressCallback: (d) => {
        if (!d.file) return;
        if (d.status === "initiate") {
          files.set(d.file, { loaded: 0, total: d.total ?? 0 });
          report(true);
        } else if (d.status === "progress" || d.status === "download") {
          const prev = files.get(d.file);
          files.set(d.file, {
            loaded: d.loaded ?? prev?.loaded ?? 0,
            total: d.total ?? prev?.total ?? 0,
          });
          report(false);
        } else if (d.status === "done") {
          const prev = files.get(d.file);
          const total = d.total ?? prev?.total ?? 0;
          files.set(d.file, { loaded: total, total });
          report(true);
        }
      },
    });
    post({
      type: "model-load",
      taskId,
      payload: {
        modelId: model.id,
        status: "ready",
        percentage: 100,
        message: "Model ready.",
        backend: device,
      },
    });
    post({ type: "prefetch-done", taskId });
  } catch (err) {
    post({ type: "error", taskId, error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleStart(
  payload: import("./workerMessages").StartInferenceMessage["payload"],
): Promise<void> {
  const { taskId } = payload;
  const controller = new AbortController();
  controllers.set(taskId, controller);

  try {
    const main: WorkerImageInput = {
      id: payload.mainImage.id,
      imageData: imageDataFromBitmap(payload.mainImage.bitmap),
      width: payload.mainImage.width,
      height: payload.mainImage.height,
      mimeType: payload.mainImage.mimeType,
      fileName: payload.mainImage.fileName,
    };
    payload.mainImage.bitmap.close();

    const references: WorkerReferenceInput[] = payload.referenceImages.map((ref) => {
      const data: WorkerReferenceInput = {
        id: ref.id,
        imageData: imageDataFromBitmap(ref.bitmap),
        width: ref.width,
        height: ref.height,
        mimeType: ref.mimeType,
        fileName: ref.fileName,
        referenceType: ref.referenceType,
      };
      ref.bitmap.close();
      return data;
    });

    const output = await runPipeline(
      {
        taskId,
        main,
        references,
        intent: payload.intent,
        model: payload.model,
        backend: payload.backend,
        engine: payload.engine,
        useMock: payload.useMock,
        maxWorkingSize: payload.maxWorkingSize,
        signal: controller.signal,
        onModelProgress: (p) => post({ type: "model-load", taskId, payload: p }),
      },
      {
        onProgress: (p) => post({ type: "processing-progress", taskId, payload: p }),
        onTileProgress: (p) => post({ type: "tile-progress", taskId, payload: p }),
        onLog: (e) => post({ type: "log", taskId, payload: e }),
      },
    );

    post(
      {
        type: "completed",
        taskId,
        payload: {
          taskType: output.taskType,
          outputBlob: output.outputBlob,
          imageData: output.imageData,
          mimeType: output.mimeType,
          width: output.width,
          height: output.height,
          processingDurationMs: output.processingDurationMs,
          usedBackend: output.usedBackend,
          usedMock: output.usedMock,
          warnings: output.warnings,
        },
      },
      [output.imageData.data.buffer],
    );
  } catch (err) {
    if (err instanceof CancelledError || controller.signal.aborted) {
      post({ type: "cancelled", taskId });
    } else {
      post({
        type: "error",
        taskId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } finally {
    controllers.delete(taskId);
  }
}
