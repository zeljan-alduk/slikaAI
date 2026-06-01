import type { RetouchTask } from "../models/types";

export type ExportFormat = "image/png" | "image/jpeg" | "image/webp";

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  extension: string;
}

const ALL_FORMATS: ExportFormatOption[] = [
  { value: "image/png", label: "PNG (lossless, transparency)", extension: "png" },
  { value: "image/jpeg", label: "JPEG (smaller)", extension: "jpg" },
  { value: "image/webp", label: "WebP (modern)", extension: "webp" },
];

let webpSupport: boolean | null = null;

/** Feature-detect WebP encoding support once. */
export function isWebpExportSupported(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

export function availableExportFormats(): ExportFormatOption[] {
  return ALL_FORMATS.filter(
    (f) => f.value !== "image/webp" || isWebpExportSupported(),
  );
}

export function defaultFormatForTask(task: RetouchTask): ExportFormat {
  // Background removal must default to PNG to preserve transparency.
  return task === "background-removal" ? "image/png" : "image/jpeg";
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function buildExportFilename(task: RetouchTask, format: ExportFormat): string {
  const now = new Date();
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const ext = ALL_FORMATS.find((f) => f.value === format)?.extension ?? "png";
  return `private-ai-photo-repair_${task}_${stamp}.${ext}`;
}

/** Trigger a browser download for a blob. */
export function exportImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke after a tick so the download can start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
