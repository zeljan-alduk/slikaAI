// Fully in-browser object removal using LaMa (inpainting) via onnxruntime-web.
// Paint a mask over an object; LaMa fills it in from surrounding context.
// Nothing is uploaded — the ~198MB model downloads once (HTTP-cached).

import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
// The dev server isn't cross-origin isolated, so SharedArrayBuffer/threads are
// unavailable — force single-threaded, no-proxy wasm so the session can build.
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

type StatusFn = (msg: string, percent?: number) => void;

const MODEL_URL =
  "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx";

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function fetchModel(onStatus?: StatusFn): Promise<ArrayBuffer> {
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) throw new Error(`model fetch ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onStatus?.("download", Math.round((received / total) * 100));
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

async function getSession(onStatus?: StatusFn): Promise<ort.InferenceSession> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const buf = await fetchModel(onStatus);
    onStatus?.("loading");
    try {
      return await ort.InferenceSession.create(buf, {
        executionProviders: ["wasm"],
      });
    } catch (e) {
      console.error("[removeObject] session create failed:", e);
      throw e;
    }
  })();
  return sessionPromise;
}

function drawToData(url: string, w: number, h: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// The Carve LaMa ONNX export expects a fixed 512x512 input. We run inference at
// that size and resize the result back to outW x outH (the display aspect).
const MODEL_SIZE = 512;

export async function removeObject(
  imageUrl: string,
  maskUrl: string,
  outW: number,
  outH: number,
  onStatus?: StatusFn,
): Promise<string> {
  const session = await getSession(onStatus);
  onStatus?.("processing");

  const w = MODEL_SIZE;
  const h = MODEL_SIZE;
  const img = await drawToData(imageUrl, w, h);
  const mask = await drawToData(maskUrl, w, h);

  // image -> [1,3,H,W] float 0..1 (CHW, RGB)
  const area = w * h;
  const imgData = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    imgData[i] = img.data[i * 4] / 255;
    imgData[i + area] = img.data[i * 4 + 1] / 255;
    imgData[i + 2 * area] = img.data[i * 4 + 2] / 255;
  }
  // mask -> [1,1,H,W] float 0/1 (white = remove)
  const maskData = new Float32Array(area);
  for (let i = 0; i < area; i++) {
    maskData[i] = mask.data[i * 4] > 127 ? 1 : 0;
  }

  const imgTensor = new ort.Tensor("float32", imgData, [1, 3, h, w]);
  const maskTensor = new ort.Tensor("float32", maskData, [1, 1, h, w]);

  // Bind by input names (image first, the one containing "mask" is the mask).
  const names = session.inputNames;
  const maskName = names.find((n) => n.toLowerCase().includes("mask")) ?? names[1];
  const imageName = names.find((n) => n !== maskName) ?? names[0];
  const feeds: Record<string, ort.Tensor> = {
    [imageName]: imgTensor,
    [maskName]: maskTensor,
  };

  const results = await session.run(feeds);
  const out = results[session.outputNames[0]];
  const data = out.data as Float32Array | Uint8Array;

  // Detect 0..1 vs 0..255 output.
  let max = 0;
  for (let i = 0; i < Math.min(data.length, 5000); i++) {
    if (data[i] > max) max = data[i];
  }
  const scale = max <= 1.5 ? 255 : 1;

  const square = document.createElement("canvas");
  square.width = w;
  square.height = h;
  const sctx = square.getContext("2d")!;
  const result = sctx.createImageData(w, h);
  for (let i = 0; i < area; i++) {
    result.data[i * 4] = Math.max(0, Math.min(255, data[i] * scale));
    result.data[i * 4 + 1] = Math.max(0, Math.min(255, data[i + area] * scale));
    result.data[i * 4 + 2] = Math.max(0, Math.min(255, data[i + 2 * area] * scale));
    result.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(result, 0, 0);

  // Resize the square result back to the original aspect ratio.
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(square, 0, 0, outW, outH);
  return canvas.toDataURL("image/png");
}
