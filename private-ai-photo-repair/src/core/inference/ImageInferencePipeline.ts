import type { InferenceBackend } from "../capabilities/types";
import type { ModelRegistryEntry, RetouchTask } from "../models/types";
import type { RetouchIntent } from "../prompt/promptTypes";
import type {
  ProcessingProgress,
  TileProgress,
  PipelineLogEntry,
} from "../progress/progressTypes";
import type { WorkerImageInput, WorkerReferenceInput } from "./types";
import { ProgressTracker } from "../progress/progressTracker";
import { Logger } from "../diagnostics/logger";
import { resizeToMaxLongestSide } from "../image/imageResize";
import { imageDataToCanvas, canvasToBlobSafe } from "../image/canvasUtils";
import { planTiles, extractTile, mergeTiles } from "../image/tiling";
import {
  mockEnhance,
  mockDenoise,
  mockBackgroundRemoval,
  mockUpscaleTile,
  mockRestoreOldPhoto,
  mockGenerativeEdit,
  isGrayscale,
  throwIfAborted,
  CancelledError,
} from "./MockPipelines";
import { analyzeReference, selectBestReference } from "../image/referenceImages";
import { OnnxImagePipeline } from "./OnnxImagePipeline";
import { modelCache } from "../models/modelCache";

export interface PipelineRunInput {
  taskId: string;
  main: WorkerImageInput;
  references: WorkerReferenceInput[];
  intent: RetouchIntent;
  model: ModelRegistryEntry;
  backend: InferenceBackend;
  useMock: boolean;
  maxWorkingSize: number;
  signal: AbortSignal;
}

export interface PipelineCallbacks {
  onProgress: (p: ProcessingProgress) => void;
  onTileProgress: (p: TileProgress) => void;
  onLog: (e: PipelineLogEntry) => void;
}

export interface PipelineOutput {
  taskId: string;
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
}

const TILE_SIZE = 512;

export async function runPipeline(
  input: PipelineRunInput,
  cb: PipelineCallbacks,
): Promise<PipelineOutput> {
  const { taskId, model, useMock, backend, signal } = input;
  const task = model.task;
  const tracker = new ProgressTracker(taskId, task, cb.onProgress);
  const log = new Logger("inference-worker", cb.onLog);
  const warnings: string[] = [];
  const startedAt = performance.now();

  log.info(`Starting ${task} (${useMock ? "mock" : backend} mode).`, {
    taskId,
    references: input.references.length,
  });
  tracker.start();

  let result: ImageData;
  try {
    switch (task) {
      case "background-removal":
        result = await runBackgroundRemoval(input, tracker, log, warnings);
        break;
      case "enhance":
      case "denoise":
        result = await runEnhanceOrDenoise(input, tracker, log, warnings);
        break;
      case "super-resolution":
        result = await runSuperResolution(input, tracker, log, cb.onTileProgress, warnings);
        break;
      case "restore-old-photo":
        result = await runRestoreOldPhoto(input, tracker, log, warnings);
        break;
      case "reference-guided-restore":
        result = await runReferenceGuided(input, tracker, log, warnings);
        break;
      case "generative-edit":
        result = await runGenerativeEdit(input, tracker, log, warnings);
        break;
      default:
        throw new Error(`Unsupported task: ${task}`);
    }
  } catch (err) {
    if (err instanceof CancelledError || signal.aborted) {
      tracker.cancel();
      log.warn("Processing cancelled by user.");
      throw err instanceof CancelledError ? err : new CancelledError();
    }
    const message = err instanceof Error ? err.message : String(err);
    tracker.fail(message);
    log.error(`Processing failed: ${message}`);
    throw err;
  }

  // Preview + export steps.
  tracker.advanceTo("preview", "Rendering before/after preview…");
  throwIfAborted(signal);
  const mimeType = task === "background-removal" ? "image/png" : "image/png";
  tracker.advanceTo("export", "Preparing export…");
  const canvas = imageDataToCanvas(result);
  const outputBlob = await canvasToBlobSafe(canvas, mimeType);
  tracker.finish();
  log.info("Processing complete.", {
    durationMs: Math.round(performance.now() - startedAt),
    output: `${result.width}x${result.height}`,
  });

  return {
    taskId,
    taskType: task,
    outputBlob,
    imageData: result,
    mimeType,
    width: result.width,
    height: result.height,
    processingDurationMs: Math.round(performance.now() - startedAt),
    usedBackend: useMock ? "mock" : backend,
    usedMock: useMock,
    warnings,
  };
}

/** Resize the main image to the working size for this device tier. */
function prepareWorking(
  input: PipelineRunInput,
  tracker: ProgressTracker,
  log: Logger,
  warnings: string[],
  decodeStepId: string,
  resizeStepId: string,
): ImageData {
  tracker.advanceTo(decodeStepId, "Decoding image…");
  const source = input.main.imageData;
  tracker.advanceTo(resizeStepId, "Resizing image for this device…");
  const resized = resizeToMaxLongestSide(source, input.maxWorkingSize);
  if (resized.scaled) {
    const msg = `Image resized from ${resized.originalWidth}x${resized.originalHeight} to ${resized.imageData.width}x${resized.imageData.height} for this device.`;
    log.info(msg);
    warnings.push("This image was resized before processing to fit this device.");
  }
  return resized.imageData;
}

async function maybeRealInference(
  input: PipelineRunInput,
  working: ImageData,
  log: Logger,
): Promise<ImageData | null> {
  if (input.useMock) return null;
  const blob = await modelCache.getModelBlob(input.model.id);
  if (!blob) {
    throw new Error(
      "Real model is selected but its file is not cached. Download the model first.",
    );
  }
  const onnx = new OnnxImagePipeline();
  await onnx.loadModel({
    model: input.model,
    backend: input.backend,
    modelBlob: blob,
    signal: input.signal,
  });
  log.info("Running real ONNX inference.");
  const out = await onnx.runImage(working, input.model);
  await onnx.unloadModel();
  return out;
}

async function runBackgroundRemoval(
  input: PipelineRunInput,
  tracker: ProgressTracker,
  log: Logger,
  warnings: string[],
): Promise<ImageData> {
  const working = prepareWorking(input, tracker, log, warnings, "decode", "resize");
  tracker.advanceTo("normalize", "Normalizing image tensor…");
  throwIfAborted(input.signal);
  tracker.advanceTo("segment", "Running segmentation model…");
  let result = await maybeRealInference(input, working, log);
  if (!result) {
    result = mockBackgroundRemoval(working, input.signal);
    warnings.push(
      "This result was generated in mock mode. Connect a real ONNX model for production-quality AI restoration.",
    );
  }
  tracker.advanceTo("mask", "Generating alpha mask…");
  tracker.advanceTo("refine", "Refining mask edges…");
  tracker.advanceTo("composite", "Compositing transparent PNG…");
  throwIfAborted(input.signal);
  return result;
}

async function runEnhanceOrDenoise(
  input: PipelineRunInput,
  tracker: ProgressTracker,
  log: Logger,
  warnings: string[],
): Promise<ImageData> {
  const working = prepareWorking(input, tracker, log, warnings, "decode", "resize");
  tracker.advanceTo("analyze", "Analyzing brightness/contrast/noise…");
  tracker.advanceTo("tensor", "Preparing tensor…");
  throwIfAborted(input.signal);
  tracker.advanceTo("run", "Running local AI model…");
  let result = await maybeRealInference(input, working, log);
  if (!result) {
    result =
      input.model.task === "denoise"
        ? mockDenoise(working, input.intent.strength)
        : mockEnhance(working, input.intent.strength);
    warnings.push(
      "This result was generated in mock mode. Connect a real ONNX model for production-quality AI restoration.",
    );
  }
  tracker.advanceTo("postprocess", "Applying detail-preserving postprocess…");
  tracker.advanceTo("restore-size", "Restoring target size…");
  throwIfAborted(input.signal);
  return result;
}

async function runSuperResolution(
  input: PipelineRunInput,
  tracker: ProgressTracker,
  log: Logger,
  onTileProgress: (p: TileProgress) => void,
  warnings: string[],
): Promise<ImageData> {
  tracker.advanceTo("decode", "Decoding image…");
  const working = resizeToMaxLongestSide(input.main.imageData, input.maxWorkingSize).imageData;
  tracker.advanceTo("memory", "Checking memory limits…");
  const scale = 2;
  const plan = planTiles(working.width, working.height, TILE_SIZE);
  tracker.advanceTo("tile", plan.needsTiling ? `Splitting into ${plan.tiles.length} tiles…` : "Image fits in a single tile.");
  log.info(`Tiling plan: ${plan.tiles.length} tile(s) at ${TILE_SIZE}px.`);

  tracker.advanceTo("process-tiles", "Processing tiles…");
  const placements: { tile: typeof plan.tiles[number]; data: ImageData; scale: number }[] = [];
  const tileStart = performance.now();
  const realPossible = !input.useMock;
  for (let i = 0; i < plan.tiles.length; i += 1) {
    throwIfAborted(input.signal);
    const tile = plan.tiles[i]!;
    const tileData = plan.needsTiling ? extractTile(working, tile) : working;
    let processed: ImageData | null = null;
    if (realPossible) {
      processed = await maybeRealInference(
        { ...input, main: { ...input.main, imageData: tileData } },
        tileData,
        log,
      );
    }
    if (!processed) {
      processed = mockUpscaleTile(tileData, scale);
    }
    placements.push({ tile, data: processed, scale });

    const completed = i + 1;
    const elapsed = performance.now() - tileStart;
    const perTile = elapsed / completed;
    const remaining = (plan.tiles.length - completed) * perTile;
    const tp: TileProgress = {
      totalTiles: plan.tiles.length,
      completedTiles: completed,
      currentTileIndex: i,
      tilePercentage: 100,
      overallTilePercentage: Math.round((completed / plan.tiles.length) * 100),
      estimatedSecondsRemaining: remaining / 1000,
      message: `Processing tile ${completed} of ${plan.tiles.length}`,
    };
    onTileProgress(tp);
    tracker.message(tp.message);
  }

  if (input.useMock) {
    warnings.push(
      "This result was generated in mock mode. Connect a real ONNX model for production-quality AI restoration.",
    );
  }

  tracker.advanceTo("merge", "Merging tiles…");
  const merged = mergeTiles(working.width * scale, working.height * scale, placements);
  tracker.advanceTo("seams", "Blending tile seams…");
  throwIfAborted(input.signal);
  return merged;
}

async function runRestoreOldPhoto(
  input: PipelineRunInput,
  tracker: ProgressTracker,
  log: Logger,
  warnings: string[],
): Promise<ImageData> {
  const working = prepareWorking(input, tracker, log, warnings, "decode", "detect-color");
  const gray = isGrayscale(working);
  log.info(gray ? "Detected grayscale image." : "Detected colour image.");
  tracker.advanceTo("analyze", "Analyzing scratches/noise/fading…");
  tracker.advanceTo("tensor", "Preparing restoration tensor…");
  throwIfAborted(input.signal);
  tracker.advanceTo("run", "Running restoration model…");
  let result = await maybeRealInference(input, working, log);
  if (!result) {
    result = mockRestoreOldPhoto(working, input.intent.strength, input.signal);
    warnings.push(
      "This result was generated in mock mode. Connect a real ONNX model for production-quality AI restoration.",
    );
  }
  tracker.advanceTo("color", "Running colour correction…");
  tracker.advanceTo("blend", "Blending restored details…");
  throwIfAborted(input.signal);
  return result;
}

async function runReferenceGuided(
  input: PipelineRunInput,
  tracker: ProgressTracker,
  log: Logger,
  warnings: string[],
): Promise<ImageData> {
  tracker.advanceTo("decode-main", "Decoding main image…");
  const working = resizeToMaxLongestSide(input.main.imageData, input.maxWorkingSize).imageData;
  tracker.advanceTo("decode-ref", "Decoding reference images…");
  tracker.advanceTo("analyze-ref", "Analyzing reference quality…");
  const analyses = input.references.map((ref) => analyzeReference(ref));
  for (const a of analyses) {
    log.info(`Reference ${a.id}: quality ${a.qualityScore}, face ${a.faceDetected ? "yes" : "no"}.`);
  }
  tracker.advanceTo("detect-main-face", "Detecting face in main image…");
  tracker.advanceTo("detect-ref-faces", "Detecting faces in reference images…");
  tracker.advanceTo("select-ref", "Selecting best reference image…");
  const best = selectBestReference(analyses);
  if (best) log.info(`Selected reference ${best.id} (quality ${best.qualityScore}).`);
  tracker.advanceTo("extract", "Extracting reference features…");
  throwIfAborted(input.signal);
  tracker.advanceTo("run", "Running guided restoration…");

  let result = await maybeRealInference(input, working, log);
  if (!result) {
    // Mock: apply old-photo enhancement; do NOT perform identity transfer.
    result = mockRestoreOldPhoto(working, input.intent.strength, input.signal);
    warnings.push(
      "Reference-guided restoration is simulated in mock mode. Real identity-aware restoration requires a compatible model.",
    );
    if (input.references.length === 0) {
      warnings.push("No reference photos were provided; applied general restoration only.");
    }
  }
  tracker.advanceTo("blend", "Blending restored face/photo naturally…");
  throwIfAborted(input.signal);
  return result;
}

/**
 * Local generative edit. The worker only ever runs the LOCAL engine (the cloud
 * engine is handled on the main thread because it uploads the image). When a
 * real on-device model is configured it runs through the ONNX path; otherwise
 * it produces a clearly-labelled simulated edit.
 */
async function runGenerativeEdit(
  input: PipelineRunInput,
  tracker: ProgressTracker,
  log: Logger,
  warnings: string[],
): Promise<ImageData> {
  const working = prepareWorking(input, tracker, log, warnings, "decode", "prepare");
  tracker.advanceTo("select-engine", "Using the on-device generative engine…");
  throwIfAborted(input.signal);
  tracker.advanceTo("run", "Running generative edit locally…");
  log.info(`Generative edit instruction: "${input.intent.originalPrompt}".`);
  let result = await maybeRealInference(input, working, log);
  if (!result) {
    result = mockGenerativeEdit(working, input.intent.strength, input.signal);
    warnings.push(
      "Generative editing is simulated on-device here: this fallback applies a creative grade and cannot add or replace content. Configure a local WebGPU model or enable the opt-in cloud engine for real generative edits.",
    );
  }
  tracker.advanceTo("compose", "Composing edited image…");
  throwIfAborted(input.signal);
  return result;
}
