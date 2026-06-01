import type { DeviceCapabilities } from "./types";

function detectWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu;
}

function detectWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      !!canvas.getContext("webgl2") ||
      !!canvas.getContext("webgl") ||
      !!canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

function detectWasm(): boolean {
  try {
    if (typeof WebAssembly !== "object") return false;
    const module = new WebAssembly.Module(
      Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00),
    );
    return module instanceof WebAssembly.Module;
  } catch {
    return false;
  }
}

function detectBrowserLabel(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) return "Chrome";
  if (/chromium/i.test(ua)) return "Chromium";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && /version\//i.test(ua)) return "Safari";
  return "Unknown browser";
}

export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  let storageQuotaBytes: number | null = null;
  let storageUsageBytes: number | null = null;
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      storageQuotaBytes = estimate.quota ?? null;
      storageUsageBytes = estimate.usage ?? null;
    } catch {
      storageQuotaBytes = null;
      storageUsageBytes = null;
    }
  }

  const deviceMemoryGb =
    typeof navigator !== "undefined" && "deviceMemory" in navigator
      ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null)
      : null;

  return {
    webgpuSupported: detectWebGpu(),
    webglSupported: detectWebGl(),
    wasmSupported: detectWasm(),
    workersSupported: typeof Worker !== "undefined",
    offscreenCanvasSupported: typeof OffscreenCanvas !== "undefined",
    createImageBitmapSupported: typeof createImageBitmap === "function",
    indexedDbSupported: typeof indexedDB !== "undefined",
    cacheStorageSupported: typeof caches !== "undefined",
    secureContext: typeof isSecureContext === "boolean" ? isSecureContext : false,
    deviceMemoryGb,
    hardwareConcurrency:
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? null : null,
    storageQuotaBytes,
    storageUsageBytes,
    screenWidth: typeof window !== "undefined" ? window.screen.width : 0,
    screenHeight: typeof window !== "undefined" ? window.screen.height : 0,
    touchSupported:
      typeof navigator !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    userAgent: ua,
    browserLabel: detectBrowserLabel(ua),
  };
}
