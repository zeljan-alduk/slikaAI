import type { DeviceCapabilities } from "../capabilities/types";
import type {
  ModelRegistryEntry,
  CachedModelInfo,
  DownloadProgress,
  ModelLoadProgress,
} from "../models/types";
import type {
  ProcessingProgress,
  TileProgress,
  PipelineLogEntry,
} from "../progress/progressTypes";

export interface DiagnosticsSnapshot {
  capabilities: DeviceCapabilities | null;
  selectedModel: ModelRegistryEntry | null;
  cachedModels: CachedModelInfo[];
  downloadProgress: DownloadProgress | null;
  modelLoadProgress: ModelLoadProgress | null;
  processingProgress: ProcessingProgress | null;
  tileProgress: TileProgress | null;
  logs: PipelineLogEntry[];
}

export function buildDiagnostics(input: DiagnosticsSnapshot): DiagnosticsSnapshot {
  return {
    capabilities: input.capabilities,
    selectedModel: input.selectedModel,
    cachedModels: input.cachedModels,
    downloadProgress: input.downloadProgress,
    modelLoadProgress: input.modelLoadProgress,
    processingProgress: input.processingProgress,
    tileProgress: input.tileProgress,
    logs: input.logs,
  };
}

export function diagnosticsToJson(snapshot: DiagnosticsSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to fallback */
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
