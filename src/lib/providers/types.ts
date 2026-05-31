export type EditMode = "whole" | "brush";
export type Quality = "fast" | "standard" | "high" | "ultra";

export interface EditInput {
  image: Blob;
  mask: Blob | null;
  prompt: string;
  mode: EditMode;
  quality: Quality;
  imageW?: number; // source dimensions (used by Ultra = native resolution)
  imageH?: number;
  timeoutMs?: number; // per-request max wait
}

// Resolution (megapixels) + sampling steps per quality level. Higher = sharper
// but slower — especially on Apple Silicon. megapixels = 0 means "native"
// (Ultra): use the source image's own resolution, capped at ULTRA_MAX_MP.
export const QUALITY_PRESETS: Record<Quality, { megapixels: number; steps: number }> = {
  fast: { megapixels: 0.5, steps: 10 },
  standard: { megapixels: 0.75, steps: 16 },
  high: { megapixels: 1.0, steps: 22 }, // 1 MP = Kontext's native resolution
  ultra: { megapixels: 0, steps: 28 }, // 0 = native source resolution
};

// Safety ceiling for Ultra so a huge phone photo can't OOM the GPU / hang.
export const ULTRA_MAX_MP = 4.0;

export interface EditOutput {
  /** Either a remote https URL (fal) or a data: URL (mock / comfyui). */
  imageUrl: string;
}

export type ProviderName = "mock" | "fal" | "comfyui";
