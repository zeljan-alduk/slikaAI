import type { InferenceBackend } from "../capabilities/types";
import type { ModelRegistryEntry } from "../models/types";
import { MOCK_MODE_ENABLED } from "../models/modelRegistry";

export interface PipelinePlan {
  useMock: boolean;
  backend: InferenceBackend;
  reason: string;
}

/**
 * Decide whether a run uses the real ONNX pipeline or a mock pipeline, and
 * which backend label to report. The app prefers real inference when a model
 * URL exists and a real backend is available; otherwise it falls back to mock.
 */
export function planPipeline(
  model: ModelRegistryEntry,
  deviceBackend: InferenceBackend,
): PipelinePlan {
  const realBackendAvailable =
    deviceBackend === "webgpu" || deviceBackend === "wasm";

  if (model.modelUrl && realBackendAvailable) {
    return {
      useMock: false,
      backend: deviceBackend,
      reason: "Real ONNX model configured and a compatible backend is available.",
    };
  }

  if (!MOCK_MODE_ENABLED) {
    return {
      useMock: false,
      backend: deviceBackend,
      reason: "Mock mode is disabled; a real model is required.",
    };
  }

  if (!model.modelUrl) {
    return {
      useMock: true,
      backend: "mock",
      reason: "No real model URL is configured for this task.",
    };
  }

  return {
    useMock: true,
    backend: "mock",
    reason: "No real inference backend is available on this device.",
  };
}
