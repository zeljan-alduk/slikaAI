export type EditMode = "whole" | "brush";

export interface EditInput {
  image: Blob;
  mask: Blob | null;
  prompt: string;
  mode: EditMode;
}

export interface EditOutput {
  /** Either a remote https URL (fal) or a data: URL (mock / comfyui). */
  imageUrl: string;
}

export type ProviderName = "mock" | "fal" | "comfyui";
