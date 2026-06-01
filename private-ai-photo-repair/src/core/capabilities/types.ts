export interface DeviceCapabilities {
  webgpuSupported: boolean;
  webglSupported: boolean;
  wasmSupported: boolean;
  workersSupported: boolean;
  offscreenCanvasSupported: boolean;
  createImageBitmapSupported: boolean;
  indexedDbSupported: boolean;
  cacheStorageSupported: boolean;
  secureContext: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  storageQuotaBytes: number | null;
  storageUsageBytes: number | null;
  screenWidth: number;
  screenHeight: number;
  touchSupported: boolean;
  userAgent: string;
  browserLabel: string;
}

export type DeviceTier = "low" | "medium" | "high" | "unsupported";

export type InferenceBackend =
  | "webgpu"
  | "wasm"
  | "webgl"
  | "mock"
  | "unsupported";

/**
 * Per-tier longest-side cap (in pixels) for the working image. Kept conservative
 * so that decoding, mock processing and neural inference stay within memory on
 * phones and laptops (very large photos crash WebGPU/WASM otherwise).
 */
export const TIER_MAX_INPUT_SIZE: Record<DeviceTier, number> = {
  low: 768,
  medium: 1152,
  high: 1600,
  unsupported: 640,
};
