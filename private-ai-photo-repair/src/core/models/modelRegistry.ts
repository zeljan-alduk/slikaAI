import type { ModelRegistryEntry } from "./types";

function envUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const MOCK_MODE_ENABLED: boolean =
  (import.meta.env.VITE_ENABLE_MOCK_MODE ?? "true").toLowerCase() !== "false";

/**
 * The model registry. URLs come from env vars; when a URL is absent the entry
 * runs in mock mode. We deliberately do not hardcode unstable large model URLs.
 */
export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  {
    id: "enhance-basic-v1",
    name: "Basic Enhancement",
    task: "enhance",
    description:
      "General quality boost: brightness, contrast, saturation and mild sharpening.",
    modelUrl: envUrl(import.meta.env.VITE_ENHANCE_MODEL_URL),
    version: "1.0.0",
    estimatedSizeMb: 25,
    expectedInputSize: { width: 512, height: 512 },
    minimumTier: "low",
    preferredBackend: "webgpu",
    supportsTiling: false,
    supportsReferenceImages: false,
    enabled: true,
    mockAvailable: true,
  },
  {
    id: "denoise-v1",
    name: "Denoise",
    task: "denoise",
    description: "Reduces sensor and compression noise while preserving edges.",
    modelUrl: envUrl(import.meta.env.VITE_DENOISE_MODEL_URL),
    version: "1.0.0",
    estimatedSizeMb: 45,
    expectedInputSize: { width: 512, height: 512 },
    minimumTier: "low",
    preferredBackend: "webgpu",
    supportsTiling: true,
    supportsReferenceImages: false,
    enabled: true,
    mockAvailable: true,
  },
  {
    id: "background-removal-v1",
    name: "Background Removal",
    task: "background-removal",
    description: "Segments the foreground subject and outputs a transparent PNG.",
    modelUrl: envUrl(import.meta.env.VITE_BACKGROUND_REMOVAL_MODEL_URL),
    version: "1.0.0",
    estimatedSizeMb: 50,
    expectedInputSize: { width: 320, height: 320 },
    minimumTier: "low",
    preferredBackend: "webgpu",
    supportsTiling: false,
    supportsReferenceImages: false,
    enabled: true,
    mockAvailable: true,
  },
  {
    id: "super-resolution-2x-v1",
    name: "Super Resolution 2x",
    task: "super-resolution",
    description: "Upscales the image 2x with tile-based processing for large inputs.",
    modelUrl: envUrl(import.meta.env.VITE_SUPER_RESOLUTION_MODEL_URL),
    version: "1.0.0",
    estimatedSizeMb: 120,
    expectedInputSize: { width: 256, height: 256 },
    minimumTier: "medium",
    preferredBackend: "webgpu",
    supportsTiling: true,
    supportsReferenceImages: false,
    enabled: true,
    mockAvailable: true,
  },
  {
    id: "restore-old-photo-v1",
    name: "Face / Old Photo Restoration",
    task: "restore-old-photo",
    description:
      "Restores faded, scratched and damaged old photographs with colour balancing.",
    modelUrl: envUrl(import.meta.env.VITE_RESTORE_OLD_PHOTO_MODEL_URL),
    version: "1.0.0",
    estimatedSizeMb: 180,
    expectedInputSize: { width: 512, height: 512 },
    minimumTier: "medium",
    preferredBackend: "webgpu",
    supportsTiling: true,
    supportsReferenceImages: false,
    enabled: true,
    mockAvailable: true,
  },
  {
    id: "reference-guided-restore-v1",
    name: "Reference Guided Restoration",
    task: "reference-guided-restore",
    description:
      "Restores the same person using better reference photos to guide the result.",
    modelUrl: envUrl(import.meta.env.VITE_REFERENCE_GUIDED_RESTORE_MODEL_URL),
    version: "1.0.0",
    estimatedSizeMb: 500,
    expectedInputSize: { width: 512, height: 512 },
    minimumTier: "high",
    preferredBackend: "webgpu",
    supportsTiling: false,
    supportsReferenceImages: true,
    enabled: true,
    mockAvailable: true,
  },
  {
    id: "generative-edit-v1",
    name: "Generative Edit (hybrid)",
    task: "generative-edit",
    description:
      "Describe any edit. Runs on-device (WebGPU) when a local model is configured, or via an opt-in cloud endpoint. Falls back to a clearly-labelled on-device simulation.",
    modelUrl: envUrl(import.meta.env.VITE_GENERATIVE_EDIT_MODEL_URL),
    version: "1.0.0",
    estimatedSizeMb: 1600,
    expectedInputSize: { width: 1024, height: 1024 },
    minimumTier: "high",
    preferredBackend: "webgpu",
    supportsTiling: false,
    supportsReferenceImages: false,
    enabled: true,
    mockAvailable: true,
  },
];

export function getModelById(id: string): ModelRegistryEntry | null {
  return MODEL_REGISTRY.find((m) => m.id === id) ?? null;
}

/** A model can run in mock mode when it lacks a real URL but supports mocking. */
export function modelUsesMock(model: ModelRegistryEntry): boolean {
  return model.modelUrl === null && model.mockAvailable && MOCK_MODE_ENABLED;
}
