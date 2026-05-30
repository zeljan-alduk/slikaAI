// Fully in-browser 2x super-resolution using Swin2SR via Transformers.js.
// Useful for bringing capped edit/brush results back up in resolution.
// Nothing is uploaded; the model downloads once and is cached by the browser.

/* eslint-disable @typescript-eslint/no-explicit-any */

type StatusFn = (msg: string, percent?: number) => void;

// Cap the input so super-resolution stays within browser memory limits.
const MAX_INPUT = 1024;

let pipePromise: Promise<any> | null = null;

async function getPipeline(onStatus?: StatusFn) {
  if (pipePromise) return pipePromise;
  pipePromise = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    const progress_callback = (p: any) => {
      if (p?.status === "progress") {
        onStatus?.("download", Math.round(p.progress ?? 0));
      }
    };
    try {
      return await pipeline(
        "image-to-image",
        "Xenova/swin2SR-classical-sr-x2-64",
        { device: "webgpu", progress_callback } as any,
      );
    } catch {
      return await pipeline(
        "image-to-image",
        "Xenova/swin2SR-classical-sr-x2-64",
        { progress_callback } as any,
      );
    }
  })();
  return pipePromise;
}

// Downscale very large inputs first so the 2x result stays manageable.
function capInput(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest <= MAX_INPUT) return resolve(url);
      const s = MAX_INPUT / longest;
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function upscale(
  imageUrl: string,
  onStatus?: StatusFn,
): Promise<string> {
  onStatus?.("loading");
  const upscaler = await getPipeline(onStatus);
  onStatus?.("processing");
  const input = await capInput(imageUrl);
  const output = await upscaler(input);
  const raw = Array.isArray(output) ? output[0] : output;
  const canvas = (raw as any).toCanvas();
  // toCanvas may return an OffscreenCanvas; normalise to a data URL.
  if (canvas instanceof HTMLCanvasElement) {
    return canvas.toDataURL("image/png");
  }
  const blob = await (canvas as OffscreenCanvas).convertToBlob({
    type: "image/png",
  });
  return await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}
