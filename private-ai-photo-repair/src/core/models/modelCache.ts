import type {
  ModelCacheManager,
  ModelRegistryEntry,
  CachedModelInfo,
  DownloadProgress,
  DownloadStatus,
} from "./types";
import {
  putModel,
  getModelMeta,
  getModelBlobByKey,
  listModelMeta,
  deleteModelRecord,
  clearAllModels,
  updateModelMeta,
} from "./modelStorage";
import { validateModelBlob } from "./modelValidation";

const PROGRESS_THROTTLE_MS = 100; // ~10 UI updates per second
const SPEED_WINDOW_MS = 3000;

interface SpeedSample {
  time: number;
  bytes: number;
}

function makeProgress(
  modelId: string,
  status: DownloadStatus,
  message: string,
  partial: Partial<DownloadProgress> = {},
): DownloadProgress {
  return {
    modelId,
    status,
    downloadedBytes: 0,
    totalBytes: null,
    percentage: null,
    speedBytesPerSecond: 0,
    averageSpeedBytesPerSecond: 0,
    estimatedSecondsRemaining: null,
    startedAt: null,
    lastUpdatedAt: Date.now(),
    message,
    ...partial,
  };
}

class IndexedDbModelCache implements ModelCacheManager {
  async isModelCached(modelId: string): Promise<boolean> {
    return (await getModelMeta(modelId)) !== null;
  }

  async getCachedModelInfo(modelId: string): Promise<CachedModelInfo | null> {
    return getModelMeta(modelId);
  }

  async listCachedModels(): Promise<CachedModelInfo[]> {
    return listModelMeta();
  }

  async getModelBlob(modelId: string): Promise<Blob | null> {
    const meta = await getModelMeta(modelId);
    if (!meta) return null;
    return getModelBlobByKey(meta.storageKey);
  }

  async markModelUsed(modelId: string): Promise<void> {
    await updateModelMeta(modelId, { lastUsedAt: Date.now() });
  }

  async deleteModel(modelId: string): Promise<void> {
    await deleteModelRecord(modelId);
  }

  async deleteAllModels(): Promise<void> {
    await clearAllModels();
  }

  async downloadAndCacheModel(
    model: ModelRegistryEntry,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: DownloadProgress) => void;
    },
  ): Promise<CachedModelInfo> {
    const { signal, onProgress } = options;
    const emit = (p: DownloadProgress) => onProgress?.(p);

    if (!model.modelUrl) {
      throw new Error(
        "No model URL is configured for this model. It can only run in mock mode.",
      );
    }

    emit(makeProgress(model.id, "checking-cache", "Checking whether the model is already stored on this device…"));
    const existing = await getModelMeta(model.id);
    if (existing) {
      emit(
        makeProgress(model.id, "ready", "Model ready.", {
          downloadedBytes: existing.sizeBytes,
          totalBytes: existing.sizeBytes,
          percentage: 100,
        }),
      );
      return existing;
    }

    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(model.modelUrl, { signal });
    } catch (err) {
      if (signal?.aborted) {
        emit(makeProgress(model.id, "cancelled", "Download cancelled."));
        throw new DownloadCancelledError();
      }
      throw new Error(`Network error while downloading model: ${describeError(err)}`);
    }

    if (!response.ok) {
      throw new Error(`Model download failed with HTTP ${response.status}.`);
    }

    const contentLength = response.headers.get("Content-Length");
    const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : null;
    const totalKnown = totalBytes !== null && Number.isFinite(totalBytes) && totalBytes > 0;

    const blob = await this.streamToBlob(model, response, {
      signal,
      startedAt,
      totalBytes: totalKnown ? totalBytes : null,
      contentType: response.headers.get("Content-Type") ?? "application/octet-stream",
      emit,
    });

    emit(makeProgress(model.id, "validating", "Validating model…", {
      downloadedBytes: blob.size,
      totalBytes: blob.size,
      percentage: 100,
    }));
    const validation = await validateModelBlob(model, blob);
    if (!validation.valid) {
      emit(makeProgress(model.id, "failed", "Download failed. Please retry.", {
        error: validation.error,
      }));
      throw new Error(validation.error ?? "Model validation failed.");
    }

    emit(makeProgress(model.id, "caching", "Saving model locally…", {
      downloadedBytes: blob.size,
      totalBytes: blob.size,
      percentage: 100,
    }));

    const info: CachedModelInfo = {
      modelId: model.id,
      name: model.name,
      version: model.version,
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastUsedAt: null,
      storageKey: `${model.id}@${model.version}`,
      ...(validation.computedHash ? { hashSha256: validation.computedHash } : {}),
    };

    try {
      await putModel(info, blob);
    } catch (err) {
      emit(makeProgress(model.id, "failed", "Could not save the model to local storage.", {
        error: describeError(err),
      }));
      throw new Error(`Failed to write model to cache: ${describeError(err)}`);
    }

    emit(makeProgress(model.id, "ready", "Model ready.", {
      downloadedBytes: blob.size,
      totalBytes: blob.size,
      percentage: 100,
      startedAt,
    }));

    return info;
  }

  private async streamToBlob(
    model: ModelRegistryEntry,
    response: Response,
    ctx: {
      signal?: AbortSignal;
      startedAt: number;
      totalBytes: number | null;
      contentType: string;
      emit: (p: DownloadProgress) => void;
    },
  ): Promise<Blob> {
    const { signal, startedAt, totalBytes, contentType, emit } = ctx;

    // Fallback when streaming is unavailable: read the whole body at once.
    if (!response.body) {
      const buf = await response.arrayBuffer();
      return new Blob([buf], { type: contentType });
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    let lastEmit = 0;
    const samples: SpeedSample[] = [];

    const buildProgress = (status: DownloadStatus): DownloadProgress => {
      const now = Date.now();
      samples.push({ time: now, bytes: downloadedBytes });
      while (samples.length > 1 && now - samples[0]!.time > SPEED_WINDOW_MS) {
        samples.shift();
      }
      const first = samples[0]!;
      const windowMs = now - first.time;
      const windowBytes = downloadedBytes - first.bytes;
      const speed = windowMs > 0 ? (windowBytes / windowMs) * 1000 : 0;
      const elapsedMs = now - startedAt;
      const avgSpeed = elapsedMs > 0 ? (downloadedBytes / elapsedMs) * 1000 : 0;
      const percentage = totalBytes ? (downloadedBytes / totalBytes) * 100 : null;
      const remainingBytes = totalBytes ? totalBytes - downloadedBytes : null;
      const eta =
        remainingBytes !== null && speed > 0 ? remainingBytes / speed : null;
      return {
        modelId: model.id,
        status,
        downloadedBytes,
        totalBytes,
        percentage,
        speedBytesPerSecond: speed,
        averageSpeedBytesPerSecond: avgSpeed,
        estimatedSecondsRemaining: eta,
        startedAt,
        lastUpdatedAt: now,
        message: totalBytes
          ? "Downloading model…"
          : "Downloading model… Total size unknown.",
      };
    };

    emit(buildProgress("downloading"));

    for (;;) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => undefined);
        emit(makeProgress(model.id, "cancelled", "Download cancelled.", {
          downloadedBytes,
          totalBytes,
        }));
        throw new DownloadCancelledError();
      }

      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (err) {
        if (signal?.aborted) {
          emit(makeProgress(model.id, "cancelled", "Download cancelled."));
          throw new DownloadCancelledError();
        }
        throw new Error(`Download stream error: ${describeError(err)}`);
      }

      if (result.done) break;
      const chunk = result.value;
      chunks.push(chunk);
      downloadedBytes += chunk.byteLength;

      const now = Date.now();
      if (now - lastEmit >= PROGRESS_THROTTLE_MS) {
        lastEmit = now;
        emit(buildProgress("downloading"));
      }
    }

    emit(buildProgress("downloading"));
    return new Blob(chunks as BlobPart[], { type: contentType });
  }
}

export class DownloadCancelledError extends Error {
  constructor() {
    super("Download cancelled.");
    this.name = "DownloadCancelledError";
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Remove models unused for longer than maxAgeDays. Returns deleted ids. */
export async function runStorageSaver(maxAgeDays: number): Promise<string[]> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const models = await listModelMeta();
  const deleted: string[] = [];
  for (const model of models) {
    const reference = model.lastUsedAt ?? model.cachedAt;
    if (reference < cutoff) {
      await deleteModelRecord(model.modelId);
      deleted.push(model.modelId);
    }
  }
  return deleted;
}

export const modelCache: ModelCacheManager = new IndexedDbModelCache();
