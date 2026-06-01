import type { RetouchTask } from "../models/types";
import { resizeToMaxLongestSide, resizeToExact } from "../image/imageResize";
import { CancelledError, throwIfAborted } from "./MockPipelines";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Transformers.js types are intentionally loose here; the library's runtime
// objects (pipelines, processors, tensors) are not well captured by static
// types and differ across tasks, so we use `any` at the boundary.

type TfDevice = "webgpu" | "wasm";
type TfModule = typeof import("@huggingface/transformers");

export type TfProgressCallback = (data: {
  status?: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}) => void;

export interface TransformersRunOptions {
  device: TfDevice;
  progressCallback?: TfProgressCallback;
  signal?: AbortSignal;
}

// Largest input edge fed to the (memory-hungry) super-resolution / restoration
// models. Keeps in-browser inference feasible across devices.
const SR_INPUT_CAP = 512;

let tfPromise: Promise<TfModule> | null = null;

async function getTf(): Promise<TfModule> {
  if (!tfPromise) {
    tfPromise = import("@huggingface/transformers").then((mod) => {
      // We only ever load remote models from the Hugging Face Hub.
      (mod.env as any).allowLocalModels = false;
      return mod;
    });
  }
  return tfPromise;
}

// Cache loaded models/pipelines per (id, device) so they are downloaded once
// and reused across runs within the worker's lifetime.
const loaded = new Map<string, Promise<any>>();

async function loadMatting(id: string, device: TfDevice, progress?: TfProgressCallback): Promise<any> {
  const key = `matting:${id}:${device}`;
  let entry = loaded.get(key);
  if (!entry) {
    entry = (async () => {
      const tf = await getTf();
      const model = await tf.AutoModel.from_pretrained(id, {
        device,
        progress_callback: progress as any,
      });
      const processor = await tf.AutoProcessor.from_pretrained(id, {
        progress_callback: progress as any,
      });
      return { tf, model, processor };
    })();
    loaded.set(key, entry);
  }
  return entry;
}

async function loadImageToImage(id: string, device: TfDevice, progress?: TfProgressCallback): Promise<any> {
  const key = `i2i:${id}:${device}`;
  let entry = loaded.get(key);
  if (!entry) {
    entry = (async () => {
      const tf = await getTf();
      const pipe = await tf.pipeline("image-to-image", id, {
        device,
        progress_callback: progress as any,
      });
      return { tf, pipe };
    })();
    loaded.set(key, entry);
  }
  return entry;
}

function rawToImageData(tf: TfModule, raw: any): ImageData {
  const rgba = raw.channels === 4 ? raw : raw.rgba();
  void tf;
  return new ImageData(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height);
}

async function runMatting(
  id: string,
  imageData: ImageData,
  options: TransformersRunOptions,
): Promise<ImageData> {
  const { device, progressCallback, signal } = options;
  const { tf, model, processor } = await loadMatting(id, device, progressCallback);
  throwIfAborted(signal);

  const source = new tf.RawImage(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
    4,
  );
  const rgb = source.rgb();
  const processed: any = await processor(rgb);
  throwIfAborted(signal);

  const result: any = await model({ input: processed.pixel_values });
  const tensor: any = result.output ?? Object.values(result)[0];
  const mask = await tf.RawImage.fromTensor(tensor[0].mul(255).to("uint8")).resize(
    imageData.width,
    imageData.height,
  );

  const rgba = new tf.RawImage(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
    4,
  ).rgba();
  rgba.putAlpha(mask);
  return rawToImageData(tf, rgba);
}

async function runImageToImage(
  id: string,
  imageData: ImageData,
  options: TransformersRunOptions,
): Promise<ImageData> {
  const { device, progressCallback, signal } = options;
  const { tf, pipe } = await loadImageToImage(id, device, progressCallback);
  throwIfAborted(signal);

  const input = new tf.RawImage(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
    4,
  ).rgb();
  const out: any = await pipe(input);
  const raw = Array.isArray(out) ? out[0] : out;
  return rawToImageData(tf, raw);
}

/**
 * Run a real Transformers.js model for the given task. Returns processed RGBA
 * ImageData. Throws CancelledError if aborted, or any model error (the caller
 * may fall back to a mock pipeline).
 */
export async function runTransformersTask(
  task: RetouchTask,
  modelId: string,
  imageData: ImageData,
  options: TransformersRunOptions,
): Promise<ImageData> {
  throwIfAborted(options.signal);

  if (task === "background-removal") {
    return runMatting(modelId, imageData, options);
  }

  // All other supported real tasks use an image-to-image restoration backbone.
  const capped = resizeToMaxLongestSide(imageData, SR_INPUT_CAP).imageData;
  const output = await runImageToImage(modelId, capped, options);

  if (task === "super-resolution") {
    return output; // keep the upscaled result
  }

  // enhance / denoise / restore-old-photo / reference-guided-restore:
  // bring the restored result back to the original working size.
  return resizeToExact(output, imageData.width, imageData.height);
}

export { CancelledError };
