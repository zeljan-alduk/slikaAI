import type { InferenceBackend } from "../capabilities/types";
import type { ModelRegistryEntry, InferenceEngine } from "../models/types";
import { MOCK_MODE_ENABLED } from "../models/modelRegistry";

export interface PipelinePlan {
  useMock: boolean;
  engine: InferenceEngine;
  backend: InferenceBackend;
  reason: string;
}

export interface PlanOptions {
  /** Force the deterministic mock pipeline (used by e2e tests and a manual override). */
  forceMock?: boolean;
}

/**
 * Decide which engine a run uses (Transformers.js, raw ONNX, or mock) and which
 * backend label to report. Preference: real Transformers.js model → real ONNX
 * model → mock fallback.
 */
export function planPipeline(
  model: ModelRegistryEntry,
  deviceBackend: InferenceBackend,
  options: PlanOptions = {},
): PipelinePlan {
  const realBackendAvailable =
    deviceBackend === "webgpu" || deviceBackend === "wasm";

  if (options.forceMock && model.mockAvailable && MOCK_MODE_ENABLED) {
    return {
      useMock: true,
      engine: "mock",
      backend: "mock",
      reason: "Mock pipeline forced (test/override).",
    };
  }

  if (model.transformersModelId && realBackendAvailable) {
    return {
      useMock: false,
      engine: "transformers",
      backend: deviceBackend,
      reason: "Real Transformers.js model available for this task.",
    };
  }

  if (model.modelUrl && realBackendAvailable) {
    return {
      useMock: false,
      engine: "onnx",
      backend: deviceBackend,
      reason: "Real ONNX model configured and a compatible backend is available.",
    };
  }

  if (!MOCK_MODE_ENABLED) {
    return {
      useMock: false,
      engine: model.transformersModelId ? "transformers" : "onnx",
      backend: deviceBackend,
      reason: "Mock mode is disabled; a real model is required.",
    };
  }

  return {
    useMock: true,
    engine: "mock",
    backend: "mock",
    reason: realBackendAvailable
      ? "No real model is configured for this task."
      : "No real inference backend is available on this device.",
  };
}
