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
  }
});

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
