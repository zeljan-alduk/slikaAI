import type { IntentStrength } from "../prompt/promptTypes";
import { cloneImageData } from "../image/canvasUtils";
import { drawScaled } from "../image/canvasUtils";

export class CancelledError extends Error {
  constructor() {
    super("Processing cancelled.");
    this.name = "CancelledError";
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError();
}

const STRENGTH_FACTOR: Record<IntentStrength, number> = {
  low: 0.4,
  medium: 1,
  high: 1.8,
};

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Brightness / contrast / saturation adjustment plus mild unsharp masking.
 * All operations are manual so they run identically in any worker context.
 */
export function mockEnhance(input: ImageData, strength: IntentStrength): ImageData {
  const f = STRENGTH_FACTOR[strength];
  const contrast = 1 + 0.12 * f;
  const brightness = 6 * f;
  const saturation = 1 + 0.18 * f;
  const out = cloneImageData(input);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i]!;
    let g = px[i + 1]!;
    let b = px[i + 2]!;
    // contrast around mid-gray, then brightness
    r = (r - 128) * contrast + 128 + brightness;
    g = (g - 128) * contrast + 128 + brightness;
    b = (b - 128) * contrast + 128 + brightness;
    // saturation around luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;
    px[i] = clamp8(r);
    px[i + 1] = clamp8(g);
    px[i + 2] = clamp8(b);
  }
  return unsharpMask(out, 0.35 * f);
}

/** 3x3 unsharp mask using a separable-ish blur subtraction. */
function unsharpMask(input: ImageData, amount: number): ImageData {
  if (amount <= 0) return input;
  const blurred = boxBlur(input, 1);
  const out = cloneImageData(input);
  const px = out.data;
  const src = input.data;
  const bl = blurred.data;
  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const detail = src[i + c]! - bl[i + c]!;
      px[i + c] = clamp8(src[i + c]! + detail * amount);
    }
  }
  return out;
}

/** Simple box blur with the given radius (used for denoise and sharpening). */
function boxBlur(input: ImageData, radius: number): ImageData {
  if (radius <= 0) return cloneImageData(input);
  const { width, height } = input;
  const src = input.data;
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const window = radius * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < height; y += 1) {
    for (let c = 0; c < 3; c += 1) {
      let sum = 0;
      for (let x = -radius; x <= radius; x += 1) {
        const xi = Math.min(width - 1, Math.max(0, x));
        sum += src[(y * width + xi) * 4 + c]!;
      }
      for (let x = 0; x < width; x += 1) {
        tmp[(y * width + x) * 4 + c] = sum / window;
        const xOut = Math.max(0, x - radius);
        const xIn = Math.min(width - 1, x + radius + 1);
        sum += src[(y * width + xIn) * 4 + c]! - src[(y * width + xOut) * 4 + c]!;
      }
    }
  }
  // Vertical pass
  for (let x = 0; x < width; x += 1) {
    for (let c = 0; c < 3; c += 1) {
      let sum = 0;
      for (let y = -radius; y <= radius; y += 1) {
        const yi = Math.min(height - 1, Math.max(0, y));
        sum += tmp[(yi * width + x) * 4 + c]!;
      }
      for (let y = 0; y < height; y += 1) {
        out[(y * width + x) * 4 + c] = sum / window;
        const yOut = Math.max(0, y - radius);
        const yIn = Math.min(height - 1, y + radius + 1);
        sum += tmp[(yIn * width + x) * 4 + c]! - tmp[(yOut * width + x) * 4 + c]!;
      }
    }
  }
  // copy alpha
  for (let i = 3; i < src.length; i += 4) out[i] = src[i]!;
  return new ImageData(out, width, height);
}

/**
 * Edge-preserving smoothing approximation: blend a blurred version toward the
 * original where local contrast (edges) is high, smoothing flat regions more.
 */
export function mockDenoise(input: ImageData, strength: IntentStrength): ImageData {
  const f = STRENGTH_FACTOR[strength];
  const radius = Math.max(1, Math.round(f));
  const blurred = boxBlur(input, radius);
  const out = cloneImageData(input);
  const px = out.data;
  const src = input.data;
  const bl = blurred.data;
  const { width } = input;
  for (let i = 0; i < px.length; i += 4) {
    const p = i / 4;
    const x = p % width;
    // local gradient magnitude on luminance to detect edges
    const right = i + 4;
    const edge =
      right < src.length && x < width - 1
        ? Math.abs(
            (0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!) -
              (0.299 * src[right]! + 0.587 * src[right + 1]! + 0.114 * src[right + 2]!),
          )
        : 0;
    // keep edges sharp (low blend), smooth flats (high blend)
    const blend = Math.max(0, 1 - edge / 24) * Math.min(1, 0.5 + 0.3 * f);
    for (let c = 0; c < 3; c += 1) {
      px[i + c] = clamp8(src[i + c]! * (1 - blend) + bl[i + c]! * blend);
    }
  }
  return out;
}

/**
 * Mock background removal: produce an alpha mask favouring a central elliptical
 * subject with a feathered border, yielding a transparent PNG. This is clearly
 * not a real segmentation model.
 */
export function mockBackgroundRemoval(
  input: ImageData,
  signal?: AbortSignal,
): ImageData {
  const { width, height } = input;
  const out = cloneImageData(input);
  const px = out.data;
  const cx = width / 2;
  const cy = height * 0.46;
  const rx = width * 0.42;
  const ry = height * 0.5;
  const feather = 0.18;
  for (let y = 0; y < height; y += 1) {
    if ((y & 63) === 0) throwIfAborted(signal);
    for (let x = 0; x < width; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const dist = Math.sqrt(nx * nx + ny * ny);
      let alpha: number;
      if (dist <= 1 - feather) alpha = 255;
      else if (dist >= 1 + feather) alpha = 0;
      else alpha = clamp8(255 * (1 - (dist - (1 - feather)) / (2 * feather)));
      px[(y * width + x) * 4 + 3] = alpha;
    }
  }
  return out;
}

/**
 * Smart-crop mock: without a real grounding model we can't locate the named
 * subject, so we crop to a centred region as a clearly-labelled placeholder.
 */
export function mockSmartCrop(input: ImageData, signal?: AbortSignal): ImageData {
  throwIfAborted(signal);
  const { width, height } = input;
  const w = Math.max(1, Math.round(width * 0.65));
  const h = Math.max(1, Math.round(height * 0.65));
  const x = Math.floor((width - w) / 2);
  const y = Math.floor((height - h) / 2);
  const out = new ImageData(w, h);
  for (let row = 0; row < h; row += 1) {
    if ((row & 63) === 0) throwIfAborted(signal);
    const srcStart = ((y + row) * width + x) * 4;
    const dstStart = row * w * 4;
    out.data.set(input.data.subarray(srcStart, srcStart + w * 4), dstStart);
  }
  return out;
}

/** High-quality canvas upscale used by the super-resolution mock. */
export function mockUpscaleTile(input: ImageData, scale: number): ImageData {
  return drawScaled(
    input,
    Math.round(input.width * scale),
    Math.round(input.height * scale),
  );
}

/**
 * Old photo restoration mock: gentle denoise, contrast/levels normalisation and
 * a warm colour rebalance to counter fading.
 */
export function mockRestoreOldPhoto(
  input: ImageData,
  strength: IntentStrength,
  signal?: AbortSignal,
): ImageData {
  throwIfAborted(signal);
  const denoised = mockDenoise(input, "low");
  const f = STRENGTH_FACTOR[strength];

  // Auto-levels: stretch luminance histogram between low/high percentiles.
  const { lo, hi } = luminancePercentiles(denoised, 0.01, 0.99);
  const range = Math.max(1, hi - lo);
  const out = cloneImageData(denoised);
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const stretched = ((px[i + c]! - lo) / range) * 255;
      px[i + c] = clamp8(stretched);
    }
    // mild warm rebalance to counter blue/green fading
    px[i] = clamp8(px[i]! + 4 * f);
    px[i + 2] = clamp8(px[i + 2]! - 2 * f);
  }
  return unsharpMask(out, 0.25 * f);
}

function luminancePercentiles(
  data: ImageData,
  lowP: number,
  highP: number,
): { lo: number; hi: number } {
  const hist = new Array<number>(256).fill(0);
  const px = data.data;
  let total = 0;
  for (let i = 0; i < px.length; i += 4) {
    const lum = Math.round(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
    hist[lum] = (hist[lum] ?? 0) + 1;
    total += 1;
  }
  const lowCount = total * lowP;
  const highCount = total * highP;
  let cumulative = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v += 1) {
    cumulative += hist[v]!;
    if (cumulative >= lowCount) {
      lo = v;
      break;
    }
  }
  cumulative = 0;
  for (let v = 0; v < 256; v += 1) {
    cumulative += hist[v]!;
    if (cumulative >= highCount) {
      hi = v;
      break;
    }
  }
  return { lo, hi };
}

/** Detect whether an image is effectively grayscale. */
export function isGrayscale(data: ImageData): boolean {
  const px = data.data;
  const step = 4 * Math.max(1, Math.floor(px.length / 4 / 4096));
  let colored = 0;
  let count = 0;
  for (let i = 0; i < px.length; i += step) {
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    if (Math.abs(r - g) > 12 || Math.abs(g - b) > 12) colored += 1;
    count += 1;
  }
  return count > 0 && colored / count < 0.03;
}
