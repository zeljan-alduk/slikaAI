import type {
  DeviceCapabilities,
  DeviceTier,
  InferenceBackend,
} from "./types";
import { TIER_MAX_INPUT_SIZE } from "./types";

/**
 * Map raw capabilities to a coarse device tier. When memory is unknown we infer
 * conservatively from core count.
 */
export function computeDeviceTier(caps: DeviceCapabilities): DeviceTier {
  const baselineOk =
    caps.workersSupported &&
    caps.wasmSupported &&
    (caps.indexedDbSupported || caps.cacheStorageSupported);

  if (!baselineOk) return "unsupported";

  const cores = caps.hardwareConcurrency ?? 2;
  const mem = caps.deviceMemoryGb; // null when unknown

  // High: WebGPU plus strong CPU/memory.
  if (caps.webgpuSupported && (cores >= 8 || (mem !== null && mem >= 8))) {
    return "high";
  }

  // Low: weak CPU or known-small memory.
  if (cores < 4 || (mem !== null && mem <= 4)) {
    return "low";
  }

  // Medium: mid CPU or 4-8 GB memory.
  if (cores <= 7 || (mem !== null && mem > 4 && mem <= 8)) {
    return "medium";
  }

  // Strong CPU without WebGPU still lands at medium (no WebGPU acceleration).
  return caps.webgpuSupported ? "high" : "medium";
}

/**
 * Select the best available inference backend. The app always degrades to
 * "mock" rather than failing, and only reports "unsupported" when even the
 * mock pipeline cannot run.
 *
 * WebGPU is only chosen when the caller explicitly opts in (`preferWebGpu`),
 * because its execution path crashes some browsers on certain models. The
 * default is the reliable WebAssembly (CPU) backend.
 */
export function selectBackend(
  caps: DeviceCapabilities,
  tier: DeviceTier,
  preferWebGpu = false,
): InferenceBackend {
  if (tier === "unsupported") return "unsupported";
  if (preferWebGpu && caps.webgpuSupported && caps.secureContext) return "webgpu";
  if (caps.wasmSupported) return "wasm";
  if (caps.webglSupported) return "webgl";
  // Mock pipeline only needs canvas, which exists in any real browser.
  return "mock";
}

export function maxInputSizeForTier(tier: DeviceTier): number {
  return TIER_MAX_INPUT_SIZE[tier];
}

export function backendLabel(backend: InferenceBackend): string {
  switch (backend) {
    case "webgpu":
      return "WebGPU (GPU accelerated)";
    case "wasm":
      return "WebAssembly (CPU)";
    case "webgl":
      return "WebGL";
    case "mock":
      return "Mock (simulated)";
    case "unsupported":
      return "Unsupported";
  }
}

export function tierLabel(tier: DeviceTier): string {
  switch (tier) {
    case "high":
      return "High performance";
    case "medium":
      return "Medium performance";
    case "low":
      return "Low performance";
    case "unsupported":
      return "Unsupported device";
  }
}
