export type EditMode = "whole" | "brush";
export type Quality = "fast" | "standard" | "high";

export interface EditInput {
  image: Blob;
  mask: Blob | null;
  prompt: string;
  mode: EditMode;
  quality: Quality;
}

// Resolution (megapixels) + sampling steps per quality level. Higher = sharper
// but slower — especially on Apple Silicon.
export const QUALITY_PRESETS: Record<Quality, { megapixels: number; steps: number }> = {
  fast: { megapixels: 0.5, steps: 10 },
  standard: { megapixels: 0.75, steps: 16 },
  high: { megapixels: 1.0, steps: 22 }, // 1 MP = Kontext's native resolution
};

export interface EditOutput {
  /** Either a remote https URL (fal) or a data: URL (mock / comfyui). */
  imageUrl: string;
}

export type ProviderName = "mock" | "fal" | "comfyui";
