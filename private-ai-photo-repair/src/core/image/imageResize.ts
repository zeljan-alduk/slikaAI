import { drawScaled } from "./canvasUtils";

export interface ResizeResult {
  imageData: ImageData;
  scaled: boolean;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Resize image data so the longest side does not exceed maxLongestSide,
 * preserving aspect ratio. Never upscales.
 */
export function resizeToMaxLongestSide(
  data: ImageData,
  maxLongestSide: number,
): ResizeResult {
  const { width, height } = data;
  const longest = Math.max(width, height);
  if (longest <= maxLongestSide) {
    return {
      imageData: data,
      scaled: false,
      originalWidth: width,
      originalHeight: height,
    };
  }
  const scale = maxLongestSide / longest;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  return {
    imageData: drawScaled(data, targetWidth, targetHeight),
    scaled: true,
    originalWidth: width,
    originalHeight: height,
  };
}

/** Resize to an exact width/height (used by model input adapters). */
export function resizeToExact(
  data: ImageData,
  width: number,
  height: number,
): ImageData {
  if (data.width === width && data.height === height) return data;
  return drawScaled(data, width, height);
}
