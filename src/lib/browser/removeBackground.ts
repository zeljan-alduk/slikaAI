// Fully in-browser background removal using Transformers.js (RMBG-1.4).
// Nothing is uploaded — the model downloads once (cached by the browser) and
// runs on WebGPU when available, falling back to WASM.

/* eslint-disable @typescript-eslint/no-explicit-any */

type StatusFn = (msg: string, percent?: number) => void;

let modelPromise: Promise<{ model: any; processor: any; device: string }> | null =
  null;

async function loadModel(onStatus?: StatusFn) {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    const { AutoModel, AutoProcessor, env } = await import(
      "@huggingface/transformers"
    );
    env.allowLocalModels = false;

    const progress_callback = (p: any) => {
      if (p?.status === "progress" && p?.file?.endsWith?.(".onnx")) {
        onStatus?.("download", Math.round(p.progress ?? 0));
      }
    };

    const processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4", {
      // RMBG-1.4 ships no preprocessor_config; provide it explicitly.
      config: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        image_std: [1, 1, 1],
        feature_extractor_type: "ImageFeatureExtractor",
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 },
      },
    } as any);

    // Try WebGPU first; fall back to WASM if it's unavailable.
    let model: any;
    let device = "webgpu";
    try {
      model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
        config: { model_type: "custom" } as any,
        device: "webgpu",
        progress_callback,
      } as any);
    } catch {
      device = "wasm";
      model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
        config: { model_type: "custom" } as any,
        progress_callback,
      } as any);
    }
    return { model, processor, device };
  })();
  return modelPromise;
}

export async function removeBackground(
  imageUrl: string,
  onStatus?: StatusFn,
): Promise<string> {
  const { RawImage } = await import("@huggingface/transformers");
  onStatus?.("loading");
  const { model, processor } = await loadModel(onStatus);

  onStatus?.("processing");
  const image = await RawImage.fromURL(imageUrl);
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });

  // output is a single-channel alpha mask; resize to the original dimensions.
  const mask = await RawImage.fromTensor(
    (output[0] as any).mul(255).to("uint8"),
  ).resize(image.width, image.height);

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage((image as any).toCanvas(), 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height);
  for (let i = 0; i < mask.data.length; i++) {
    pixels.data[4 * i + 3] = mask.data[i];
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}
