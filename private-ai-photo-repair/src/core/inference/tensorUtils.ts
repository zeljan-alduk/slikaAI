import { resizeToExact } from "../image/imageResize";

export type TensorLayout = "nchw" | "nhwc";

export interface TensorSpec {
  layout: TensorLayout;
  /** Per-channel mean applied as (value/scale - mean) / std. */
  mean: [number, number, number];
  std: [number, number, number];
  /** Divisor applied to 0-255 values before mean/std (usually 255). */
  scale: number;
}

export const DEFAULT_TENSOR_SPEC: TensorSpec = {
  layout: "nchw",
  mean: [0, 0, 0],
  std: [1, 1, 1],
  scale: 255,
};

export interface FloatTensor {
  data: Float32Array;
  dims: number[];
  layout: TensorLayout;
}

/** Resize ImageData to a model's expected input size. */
export function resizeToModelInput(
  data: ImageData,
  width: number,
  height: number,
): ImageData {
  return resizeToExact(data, width, height);
}

/** Normalize a single 0-255 channel value with the given spec. */
export function normalizeValue(value: number, spec: TensorSpec, channel: number): number {
  return (value / spec.scale - spec.mean[channel]!) / spec.std[channel]!;
}

/**
 * Convert RGBA ImageData into a planar/interleaved float tensor for ONNX.
 * Produces a batch dimension of 1.
 */
export function imageDataToFloatTensor(
  data: ImageData,
  spec: TensorSpec = DEFAULT_TENSOR_SPEC,
): FloatTensor {
  const { width, height, data: px } = data;
  const pixelCount = width * height;
  const out = new Float32Array(pixelCount * 3);

  if (spec.layout === "nchw") {
    const planeSize = pixelCount;
    for (let p = 0; p < pixelCount; p += 1) {
      const i = p * 4;
      out[p] = normalizeValue(px[i]!, spec, 0);
      out[planeSize + p] = normalizeValue(px[i + 1]!, spec, 1);
      out[2 * planeSize + p] = normalizeValue(px[i + 2]!, spec, 2);
    }
    return { data: out, dims: [1, 3, height, width], layout: "nchw" };
  }

  for (let p = 0; p < pixelCount; p += 1) {
    const i = p * 4;
    const o = p * 3;
    out[o] = normalizeValue(px[i]!, spec, 0);
    out[o + 1] = normalizeValue(px[i + 1]!, spec, 1);
    out[o + 2] = normalizeValue(px[i + 2]!, spec, 2);
  }
  return { data: out, dims: [1, height, width, 3], layout: "nhwc" };
}

/** Alias kept for the API surface described in the spec. */
export function normalizeImage(
  data: ImageData,
  spec: TensorSpec = DEFAULT_TENSOR_SPEC,
): FloatTensor {
  return imageDataToFloatTensor(data, spec);
}

function denormalize(value: number, spec: TensorSpec, channel: number): number {
  const v = (value * spec.std[channel]! + spec.mean[channel]!) * spec.scale;
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Convert a float tensor back to RGBA ImageData. Supports NCHW and NHWC, with
 * 3 (RGB) or 4 (RGBA) channels.
 */
export function tensorToImageData(
  tensor: FloatTensor,
  width: number,
  height: number,
  spec: TensorSpec = DEFAULT_TENSOR_SPEC,
): ImageData {
  const { data, layout } = tensor;
  const out = new Uint8ClampedArray(width * height * 4);
  const pixelCount = width * height;
  const channels =
    layout === "nchw"
      ? data.length / pixelCount
      : data.length / pixelCount;

  if (layout === "nchw") {
    const planeSize = pixelCount;
    for (let p = 0; p < pixelCount; p += 1) {
      const o = p * 4;
      out[o] = denormalize(data[p]!, spec, 0);
      out[o + 1] = denormalize(data[planeSize + p]!, spec, 1);
      out[o + 2] = denormalize(data[2 * planeSize + p]!, spec, 2);
      out[o + 3] = channels >= 4 ? denormalize(data[3 * planeSize + p]!, spec, 0) : 255;
    }
  } else {
    const stride = channels;
    for (let p = 0; p < pixelCount; p += 1) {
      const i = p * stride;
      const o = p * 4;
      out[o] = denormalize(data[i]!, spec, 0);
      out[o + 1] = denormalize(data[i + 1]!, spec, 1);
      out[o + 2] = denormalize(data[i + 2]!, spec, 2);
      out[o + 3] = channels >= 4 ? denormalize(data[i + 3]!, spec, 0) : 255;
    }
  }

  return new ImageData(out, width, height);
}
