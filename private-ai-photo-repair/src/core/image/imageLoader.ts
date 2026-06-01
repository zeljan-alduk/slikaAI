import type { UserImageAsset, SupportedMimeType } from "./types";
import { SUPPORTED_IMAGE_TYPES } from "./types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export class UnsupportedImageTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported image type "${type}". Use JPEG, PNG or WebP.`);
    this.name = "UnsupportedImageTypeError";
  }
}

export function isSupportedImageType(type: string): type is SupportedMimeType {
  return SUPPORTED_IMAGE_TYPES.includes(type);
}

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  }
  // Fallback via HTMLImageElement.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the image."));
    };
    img.src = url;
  });
}

/** Load a user-selected File into a UserImageAsset (main thread). */
export async function loadImageAsset(
  file: File,
  role: "main" | "reference",
): Promise<UserImageAsset> {
  if (!isSupportedImageType(file.type)) {
    throw new UnsupportedImageTypeError(file.type || "unknown");
  }
  const { width, height } = await readDimensions(file);
  return {
    id: nextId(role),
    role,
    file,
    objectUrl: URL.createObjectURL(file),
    width,
    height,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

/** Decode an asset's File into ImageData (used to build worker transfer data). */
export async function decodeAssetToImageData(asset: UserImageAsset): Promise<ImageData> {
  const bitmap = await createImageBitmap(asset.file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not acquire a 2D context to decode the image.");
  }
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return data;
}

export function revokeAsset(asset: UserImageAsset): void {
  if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl);
}
