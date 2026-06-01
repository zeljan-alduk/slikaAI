export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyCanvas2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/** Create a canvas that works on the main thread or inside a worker. */
export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

export function get2dContext(canvas: AnyCanvas): AnyCanvas2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as
    | AnyCanvas2D
    | null;
  if (!ctx) throw new Error("Could not acquire a 2D canvas context.");
  return ctx;
}

export function imageDataFromBitmap(bitmap: ImageBitmap): ImageData {
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const ctx = get2dContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

export function imageDataToCanvas(data: ImageData): AnyCanvas {
  const canvas = createCanvas(data.width, data.height);
  const ctx = get2dContext(canvas);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Convert any canvas to a Blob safely across DOM and worker contexts.
 * Returns null types gracefully when a format is unsupported.
 */
export async function canvasToBlobSafe(
  canvas: AnyCanvas,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    // OffscreenCanvas
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Could not encode image as ${mimeType}.`));
      },
      mimeType,
      quality,
    );
  });
}

/** Draw source onto a new canvas scaled with high-quality smoothing. */
export function drawScaled(
  source: ImageData,
  targetWidth: number,
  targetHeight: number,
): ImageData {
  const sourceCanvas = imageDataToCanvas(source);
  const target = createCanvas(targetWidth, targetHeight);
  const ctx = get2dContext(target);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    sourceCanvas as CanvasImageSource,
    0,
    0,
    source.width,
    source.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );
  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

export function cloneImageData(data: ImageData): ImageData {
  return new ImageData(
    new Uint8ClampedArray(data.data),
    data.width,
    data.height,
  );
}
