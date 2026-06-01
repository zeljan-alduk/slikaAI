export type SupportedMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface UserImageAsset {
  id: string;
  role: "main" | "reference";
  file: File;
  objectUrl: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}

export type ReferenceType =
  | "same-person"
  | "same-face"
  | "same-scene"
  | "color-style"
  | "unknown";

export interface ReferenceImageAsset extends UserImageAsset {
  role: "reference";
  referenceType: ReferenceType;
  qualityScore?: number;
  faceDetected?: boolean;
  faceEmbedding?: Float32Array;
}

/**
 * Worker-transferable form of an image asset. We pass an ImageBitmap (a
 * transferable) plus metadata instead of huge base64 strings or File objects.
 */
export interface UserImageAssetTransfer {
  id: string;
  role: "main" | "reference";
  bitmap: ImageBitmap;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

export interface ReferenceImageAssetTransfer extends UserImageAssetTransfer {
  role: "reference";
  referenceType: ReferenceType;
}

export const SUPPORTED_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
