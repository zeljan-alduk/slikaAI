import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeviceCapabilities, DeviceTier, InferenceBackend } from "../core/capabilities/types";
import type {
  ModelRegistryEntry,
  CachedModelInfo,
  DownloadProgress,
  ModelLoadProgress,
  ModelLoadStatus,
  AppSettings,
} from "../core/models/types";
import { DEFAULT_SETTINGS } from "../core/models/types";
import type { RetouchIntent } from "../core/prompt/promptTypes";
import type { UserImageAsset, ReferenceImageAsset, ReferenceType } from "../core/image/types";
import type { InferenceResult } from "../core/inference/types";
import type {
  ProcessingProgress,
  TileProgress,
  PipelineLogEntry,
} from "../core/progress/progressTypes";
import type { ExportFormat } from "../core/image/imageExport";

import { detectCapabilities } from "../core/capabilities/detectCapabilities";
import {
  computeDeviceTier,
  selectBackend,
  maxInputSizeForTier,
} from "../core/capabilities/deviceTier";
import { parseRetouchPrompt } from "../core/prompt/parseRetouchPrompt";
import { selectModelForTask, type ModelSelection } from "../core/models/modelSelector";
import { planPipeline, type PipelinePlan } from "../core/inference/pipelineFactory";
import { MODEL_REGISTRY } from "../core/models/modelRegistry";
import { modelCache, DownloadCancelledError, runStorageSaver } from "../core/models/modelCache";
import { getSettings, saveSettings } from "../core/models/modelStorage";
import { createLogEntry } from "../core/diagnostics/logger";
import {
  loadImageAsset,
  revokeAsset,
  UnsupportedImageTypeError,
} from "../core/image/imageLoader";
import {
  runInferenceInWorker,
  ProcessingCancelledError,
  getResultImageData,
  clearResultImageData,
  type RunInferenceHandle,
} from "../workers/workerClient";
import {
  exportImage,
  buildExportFilename,
  defaultFormatForTask,
} from "../core/image/imageExport";
import { imageDataToCanvas, canvasToBlobSafe } from "../core/image/canvasUtils";

export type AppPhase =
  | "detecting"
  | "ready"
  | "downloading"
  | "loading-model"
  | "processing"
  | "done"
  | "error";

export interface StartupQueueState {
  total: number;
  completedCount: number;
  currentName: string | null;
}

const MAX_LOGS = 500;
const LARGE_IMAGE_BYTES = 12 * 1024 * 1024;
let taskCounter = 0;

const LOAD_PHASES: { status: ModelLoadStatus; percentage: number; message: string }[] = [
  { status: "loading-model-file", percentage: 15, message: "Loading model file from local storage…" },
  { status: "initializing-runtime", percentage: 30, message: "Initializing ONNX Runtime…" },
  { status: "selecting-backend", percentage: 45, message: "Selecting backend…" },
  { status: "creating-session", percentage: 70, message: "Creating inference session…" },
  { status: "warming-up", percentage: 90, message: "Warming up model…" },
  { status: "ready", percentage: 100, message: "Model ready." },
];

export interface AppController {
  // capabilities
  capabilities: DeviceCapabilities | null;
  tier: DeviceTier | null;
  backend: InferenceBackend | null;
  maxWorkingSize: number;

  // images
  mainImage: UserImageAsset | null;
  referenceImages: ReferenceImageAsset[];

  // prompt / intent
  prompt: string;
  intent: RetouchIntent | null;

  // model selection
  selection: ModelSelection | null;
  plan: PipelinePlan | null;
  selectedModelCached: boolean;
  cachedModels: CachedModelInfo[];
  settings: AppSettings;

  // startup model setup
  eligibleStartupModels: ModelRegistryEntry[];
  showModelSetup: boolean;
  startupDownloading: boolean;
  startupQueue: StartupQueueState | null;

  // progress
  downloadProgress: DownloadProgress | null;
  modelLoadProgress: ModelLoadProgress | null;
  processingProgress: ProcessingProgress | null;
  tileProgress: TileProgress | null;
  logs: PipelineLogEntry[];

  // result
  result: InferenceResult | null;

  // status
  phase: AppPhase;
  error: string | null;
  isBusy: boolean;

  // actions
  setMainImageFile: (file: File) => Promise<void>;
  removeMainImage: () => void;
  addReferenceFile: (file: File) => Promise<void>;
  removeReference: (id: string) => void;
  setReferenceType: (id: string, type: ReferenceType) => void;
  setPrompt: (value: string) => void;
  downloadModel: () => Promise<void>;
  cancelDownload: () => void;
  startProcessing: () => Promise<void>;
  cancelProcessing: () => void;
  refreshCachedModels: () => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  redownloadModel: (model: ModelRegistryEntry) => Promise<void>;
  deleteAllModels: () => Promise<void>;
  setStorageSaver: (enabled: boolean) => Promise<void>;
  setStorageSaverDays: (days: number) => Promise<void>;
  startModelSetup: (modelIds: string[]) => Promise<void>;
  cancelModelSetup: () => void;
  dismissModelSetup: (dontAskAgain: boolean) => Promise<void>;
  exportResult: (format: ExportFormat) => Promise<void>;
  dismissError: () => void;
  log: (entry: PipelineLogEntry) => void;
}

export function useAppController(): AppController {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [tier, setTier] = useState<DeviceTier | null>(null);
  const [backend, setBackend] = useState<InferenceBackend | null>(null);

  const [mainImage, setMainImage] = useState<UserImageAsset | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageAsset[]>([]);
  const [prompt, setPromptState] = useState("");
  const [intent, setIntent] = useState<RetouchIntent | null>(null);

  const [cachedModels, setCachedModels] = useState<CachedModelInfo[]>([]);
  const [selectedModelCached, setSelectedModelCached] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [setupHandled, setSetupHandled] = useState(false);
  const [startupDownloading, setStartupDownloading] = useState(false);
  const [startupQueue, setStartupQueue] = useState<StartupQueueState | null>(null);
  const startupCancelRef = useRef(false);

  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<ModelLoadProgress | null>(null);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [tileProgress, setTileProgress] = useState<TileProgress | null>(null);
  const [logs, setLogs] = useState<PipelineLogEntry[]>([]);

  const [result, setResult] = useState<InferenceResult | null>(null);
  const [phase, setPhase] = useState<AppPhase>("detecting");
  const [error, setError] = useState<string | null>(null);

  const downloadAbortRef = useRef<AbortController | null>(null);
  const processingHandleRef = useRef<RunInferenceHandle | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const log = useCallback((entry: PipelineLogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  const logMessage = useCallback(
    (level: PipelineLogEntry["level"], source: PipelineLogEntry["source"], message: string, details?: Record<string, unknown>) => {
      log(createLogEntry(level, source, message, details));
    },
    [log],
  );

  // Derived selection + plan.
  const selection = useMemo<ModelSelection | null>(() => {
    if (!intent || !tier) return null;
    return selectModelForTask(intent.task, tier);
  }, [intent, tier]);

  const plan = useMemo<PipelinePlan | null>(() => {
    if (!selection?.model || !backend) return null;
    return planPipeline(selection.model, backend);
  }, [selection, backend]);

  const maxWorkingSize = useMemo(
    () => (tier ? maxInputSizeForTier(tier) : 1024),
    [tier],
  );

  // Models that have a real URL, are enabled, and are not yet cached — the only
  // ones the startup setup can actually download.
  const eligibleStartupModels = useMemo<ModelRegistryEntry[]>(() => {
    return MODEL_REGISTRY.filter(
      (m) =>
        m.enabled &&
        m.modelUrl !== null &&
        !cachedModels.some((c) => c.modelId === m.id),
    );
  }, [cachedModels]);

  const showModelSetup =
    tier !== null &&
    tier !== "unsupported" &&
    settings.promptModelSetupOnStart &&
    !setupHandled &&
    (eligibleStartupModels.length > 0 || startupDownloading);

  // Initial capability detection + settings + cache load.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const caps = await detectCapabilities();
        if (cancelled) return;
        const computedTier = computeDeviceTier(caps);
        const computedBackend = selectBackend(caps, computedTier);
        setCapabilities(caps);
        setTier(computedTier);
        setBackend(computedBackend);
        logMessage("info", "capability-detection", `Detected ${computedTier} tier, backend ${computedBackend}.`, {
          webgpu: caps.webgpuSupported,
          cores: caps.hardwareConcurrency,
          memoryGb: caps.deviceMemoryGb,
        });

        const loadedSettings = await getSettings().catch(() => settings);
        if (!cancelled) setSettings(loadedSettings);

        if (loadedSettings.storageSaverEnabled) {
          const removed = await runStorageSaver(loadedSettings.storageSaverMaxAgeDays).catch(() => []);
          if (removed.length > 0) {
            logMessage("info", "model-cache", `Storage saver removed ${removed.length} unused model(s).`);
          }
        }

        const cached = await modelCache.listCachedModels().catch(() => []);
        if (!cancelled) setCachedModels(cached);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Capability detection failed.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute whether the selected model is cached.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!selection?.model) {
        if (active) setSelectedModelCached(false);
        return;
      }
      const cached = await modelCache.isModelCached(selection.model.id);
      if (active) setSelectedModelCached(cached);
    })();
    return () => {
      active = false;
    };
  }, [selection, cachedModels]);

  const setMainImageFile = useCallback(
    async (file: File) => {
      try {
        const asset = await loadImageAsset(file, "main");
        setMainImage((prev) => {
          if (prev) revokeAsset(prev);
          return asset;
        });
        setResult(null);
        setError(null);
        if (file.size > LARGE_IMAGE_BYTES) {
          logMessage("warn", "image-preprocessor", "Large image selected; it will be resized before processing.");
        }
        logMessage("info", "image-preprocessor", `Loaded main image ${asset.width}x${asset.height}.`);
      } catch (err) {
        const message =
          err instanceof UnsupportedImageTypeError
            ? err.message
            : "Could not load the selected image.";
        setError(message);
        logMessage("error", "image-preprocessor", message);
      }
    },
    [logMessage],
  );

  const removeMainImage = useCallback(() => {
    setMainImage((prev) => {
      if (prev) revokeAsset(prev);
      return null;
    });
    setResult(null);
  }, []);

  const addReferenceFile = useCallback(
    async (file: File) => {
      try {
        const base = await loadImageAsset(file, "reference");
        const ref: ReferenceImageAsset = { ...base, role: "reference", referenceType: "unknown" };
        setReferenceImages((prev) => [...prev, ref]);
        logMessage("info", "reference-image-processor", `Added reference image ${ref.width}x${ref.height}.`);
      } catch (err) {
        const message =
          err instanceof UnsupportedImageTypeError
            ? err.message
            : "Could not load the reference image.";
        setError(message);
        logMessage("error", "reference-image-processor", message);
      }
    },
    [logMessage],
  );

  const removeReference = useCallback((id: string) => {
    setReferenceImages((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) revokeAsset(target);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const setReferenceType = useCallback((id: string, type: ReferenceType) => {
    setReferenceImages((prev) =>
      prev.map((r) => (r.id === id ? { ...r, referenceType: type } : r)),
    );
  }, []);

  const setPrompt = useCallback(
    (value: string) => {
      setPromptState(value);
      const parsed = parseRetouchPrompt(value);
      setIntent(parsed);
      if (value.trim().length > 0) {
        logMessage("debug", "prompt-parser", `Parsed task: ${parsed.task} (confidence ${parsed.confidence.toFixed(2)}).`);
      }
    },
    [logMessage],
  );

  const refreshCachedModels = useCallback(async () => {
    const cached = await modelCache.listCachedModels();
    setCachedModels(cached);
    logMessage("info", "model-cache", `Cache contains ${cached.length} model(s).`);
  }, [logMessage]);

  const downloadModel = useCallback(async () => {
    const model = selection?.model;
    if (!model) return;
    if (!model.modelUrl) {
      setError("This model has no configured URL and can only run in mock mode.");
      return;
    }
    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setPhase("downloading");
    setError(null);
    try {
      await modelCache.downloadAndCacheModel(model, {
        signal: controller.signal,
        onProgress: (p) => setDownloadProgress(p),
      });
      logMessage("info", "model-cache", `Model "${model.name}" downloaded and cached.`);
      await refreshCachedModels();
      setSelectedModelCached(true);
      setPhase("ready");
    } catch (err) {
      if (err instanceof DownloadCancelledError) {
        logMessage("warn", "model-cache", "Model download cancelled.");
        setPhase("ready");
      } else {
        const message = err instanceof Error ? err.message : "Model download failed.";
        setError(message);
        logMessage("error", "model-cache", message);
        setPhase("ready");
      }
    } finally {
      downloadAbortRef.current = null;
    }
  }, [selection, logMessage, refreshCachedModels]);

  const cancelDownload = useCallback(() => {
    downloadAbortRef.current?.abort();
  }, []);

  const simulateModelLoad = useCallback(
    async (model: ModelRegistryEntry, runBackend: InferenceBackend) => {
      setPhase("loading-model");
      for (const phaseStep of LOAD_PHASES) {
        setModelLoadProgress({
          modelId: model.id,
          status: phaseStep.status,
          percentage: phaseStep.percentage,
          message: phaseStep.message,
          backend: runBackend,
        });
        logMessage("debug", "model-loader", phaseStep.message);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    },
    [logMessage],
  );

  const startProcessing = useCallback(async () => {
    if (!mainImage || !selection?.model || !plan || !intent || !backend || !tier) {
      setError("Add an image and a recognised prompt before processing.");
      return;
    }
    const model = selection.model;

    // Raw-ONNX models must be cached before running. Transformers.js models
    // download on first use (and are cached by the browser afterwards).
    if (plan.engine === "onnx" && !(await modelCache.isModelCached(model.id))) {
      setError("Download the model before processing, or it cannot run.");
      return;
    }

    setError(null);
    setResult(null);
    setTileProgress(null);

    await simulateModelLoad(model, plan.backend);
    if (!plan.useMock) {
      await modelCache.markModelUsed(model.id).catch(() => undefined);
    }

    taskCounter += 1;
    const taskId = `task_${Date.now().toString(36)}_${taskCounter}`;
    setPhase("processing");

    const handle = runInferenceInWorker(
      {
        taskId,
        mainImage,
        referenceImages,
        intent,
        model,
        backend: plan.backend,
        engine: plan.engine,
        useMock: plan.useMock,
        maxWorkingSize,
      },
      {
        onProgress: setProcessingProgress,
        onTileProgress: setTileProgress,
        onLog: log,
      },
    );
    processingHandleRef.current = handle;

    try {
      const inferenceResult = await handle.result;
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = inferenceResult.outputObjectUrl;
      setResult(inferenceResult);
      setPhase("done");
      await refreshCachedModels();
    } catch (err) {
      if (err instanceof ProcessingCancelledError) {
        logMessage("warn", "inference-worker", "Processing cancelled.");
        setPhase("ready");
      } else {
        const message = err instanceof Error ? err.message : "Processing failed.";
        setError(message);
        logMessage("error", "inference-worker", message);
        setPhase("error");
      }
    } finally {
      processingHandleRef.current = null;
    }
  }, [
    mainImage,
    selection,
    plan,
    intent,
    backend,
    tier,
    referenceImages,
    maxWorkingSize,
    simulateModelLoad,
    log,
    logMessage,
    refreshCachedModels,
  ]);

  const cancelProcessing = useCallback(() => {
    processingHandleRef.current?.cancel();
  }, []);

  const deleteModel = useCallback(
    async (modelId: string) => {
      await modelCache.deleteModel(modelId);
      clearResultImageData(modelId);
      await refreshCachedModels();
      logMessage("info", "model-cache", `Deleted model ${modelId}.`);
    },
    [refreshCachedModels, logMessage],
  );

  const redownloadModel = useCallback(
    async (model: ModelRegistryEntry) => {
      await modelCache.deleteModel(model.id).catch(() => undefined);
      if (!model.modelUrl) {
        setError("This model has no configured URL to re-download.");
        return;
      }
      const controller = new AbortController();
      downloadAbortRef.current = controller;
      setPhase("downloading");
      try {
        await modelCache.downloadAndCacheModel(model, {
          signal: controller.signal,
          onProgress: setDownloadProgress,
        });
        await refreshCachedModels();
        setPhase("ready");
      } catch (err) {
        if (!(err instanceof DownloadCancelledError)) {
          setError(err instanceof Error ? err.message : "Re-download failed.");
        }
        setPhase("ready");
      } finally {
        downloadAbortRef.current = null;
      }
    },
    [refreshCachedModels],
  );

  const deleteAllModels = useCallback(async () => {
    await modelCache.deleteAllModels();
    await refreshCachedModels();
    setSelectedModelCached(false);
    logMessage("info", "model-cache", "Deleted all cached models.");
  }, [refreshCachedModels, logMessage]);

  const persistSettings = useCallback(async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next).catch(() => undefined);
  }, []);

  const setStorageSaver = useCallback(
    async (enabled: boolean) => {
      await persistSettings({ ...settings, storageSaverEnabled: enabled });
    },
    [settings, persistSettings],
  );

  const setStorageSaverDays = useCallback(
    async (days: number) => {
      await persistSettings({ ...settings, storageSaverMaxAgeDays: days });
    },
    [settings, persistSettings],
  );

  // Download the chosen startup models sequentially, in the background. The app
  // stays usable (we don't flip the global busy phase) and the queue can be
  // cancelled at any time.
  const startModelSetup = useCallback(
    async (modelIds: string[]) => {
      const models = MODEL_REGISTRY.filter(
        (m) => modelIds.includes(m.id) && m.modelUrl !== null,
      );
      if (models.length === 0) {
        setSetupHandled(true);
        return;
      }
      startupCancelRef.current = false;
      const controller = new AbortController();
      downloadAbortRef.current = controller;
      setStartupDownloading(true);
      setError(null);

      let completed = 0;
      for (const model of models) {
        if (startupCancelRef.current || controller.signal.aborted) break;
        setStartupQueue({ total: models.length, completedCount: completed, currentName: model.name });
        try {
          await modelCache.downloadAndCacheModel(model, {
            signal: controller.signal,
            onProgress: setDownloadProgress,
          });
          completed += 1;
          logMessage("info", "model-cache", `Downloaded "${model.name}".`);
        } catch (err) {
          if (err instanceof DownloadCancelledError) {
            logMessage("warn", "model-cache", "Model setup cancelled.");
          } else {
            const message = err instanceof Error ? err.message : "Model download failed.";
            setError(message);
            logMessage("error", "model-cache", `Failed to download "${model.name}": ${message}`);
          }
          break;
        }
      }

      downloadAbortRef.current = null;
      setStartupDownloading(false);
      setStartupQueue(null);
      setSetupHandled(true);
      await refreshCachedModels();
    },
    [logMessage, refreshCachedModels],
  );

  const cancelModelSetup = useCallback(() => {
    startupCancelRef.current = true;
    downloadAbortRef.current?.abort();
  }, []);

  const dismissModelSetup = useCallback(
    async (dontAskAgain: boolean) => {
      setSetupHandled(true);
      if (dontAskAgain) {
        await persistSettings({ ...settings, promptModelSetupOnStart: false });
      }
    },
    [settings, persistSettings],
  );

  const exportResult = useCallback(
    async (format: ExportFormat) => {
      if (!result) return;
      try {
        const data = getResultImageData(result.taskId);
        let blob = result.outputBlob;
        if (data && format !== result.mimeType) {
          const canvas = imageDataToCanvas(data);
          blob = await canvasToBlobSafe(canvas, format, format === "image/jpeg" ? 0.92 : undefined);
        }
        const filename = buildExportFilename(result.taskType, format);
        exportImage(blob, filename);
        logMessage("info", "export", `Exported ${filename}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export failed.";
        setError(message);
        logMessage("error", "export", message);
      }
    },
    [result, logMessage],
  );

  const dismissError = useCallback(() => setError(null), []);

  // Default export format suggestion when a result appears (no side effect on render).
  useEffect(() => {
    if (result) {
      logMessage(
        "info",
        "postprocessor",
        `Result ready: ${result.width}x${result.height}, ${result.usedMock ? "mock" : result.usedBackend}.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.taskId]);

  // Cleanup object URLs on unmount.
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      if (mainImage) revokeAsset(mainImage);
      referenceImages.forEach(revokeAsset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBusy = phase === "downloading" || phase === "processing" || phase === "loading-model";

  return {
    capabilities,
    tier,
    backend,
    maxWorkingSize,
    mainImage,
    referenceImages,
    prompt,
    intent,
    selection,
    plan,
    selectedModelCached,
    cachedModels,
    settings,
    eligibleStartupModels,
    showModelSetup,
    startupDownloading,
    startupQueue,
    downloadProgress,
    modelLoadProgress,
    processingProgress,
    tileProgress,
    logs,
    result,
    phase,
    error,
    isBusy,
    setMainImageFile,
    removeMainImage,
    addReferenceFile,
    removeReference,
    setReferenceType,
    setPrompt,
    downloadModel,
    cancelDownload,
    startProcessing,
    cancelProcessing,
    refreshCachedModels,
    deleteModel,
    redownloadModel,
    deleteAllModels,
    setStorageSaver,
    setStorageSaverDays,
    startModelSetup,
    cancelModelSetup,
    dismissModelSetup,
    exportResult,
    dismissError,
    log,
  };
}

export { defaultFormatForTask };
