import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EditInput, EditOutput } from "./types";
import { ensureComfyWs } from "../comfyProgress";

const COMFY = (process.env.COMFYUI_URL || "http://127.0.0.1:8188").replace(
  /\/+$/,
  "",
);
const EDIT_WORKFLOW =
  process.env.COMFYUI_EDIT_WORKFLOW || "comfyui/flux-kontext-edit.json";
const INPAINT_WORKFLOW =
  process.env.COMFYUI_INPAINT_WORKFLOW || "comfyui/flux-kontext-inpaint.json";
// Sampling on Apple Silicon is slow (minutes), and the first run also loads the
// model into memory. Generous default; override with COMFYUI_TIMEOUT_MS.
const TIMEOUT_MS = Number(process.env.COMFYUI_TIMEOUT_MS) || 600_000;

type ComfyWorkflow = Record<string, unknown>;

async function uploadImage(blob: Blob, filename: string): Promise<string> {
  const fd = new FormData();
  fd.append("image", blob, filename);
  fd.append("overwrite", "true");
  const res = await fetch(`${COMFY}/upload/image`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    throw new Error(`ComfyUI upload failed: ${res.status}`);
  }
  const data = (await res.json()) as { name: string; subfolder?: string };
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

// Replace every string that exactly equals a placeholder key with its value.
function replacePlaceholders(
  node: unknown,
  repl: Record<string, string | number>,
): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (typeof v === "string" && v in repl) node[i] = repl[v];
      else if (v && typeof v === "object") replacePlaceholders(v, repl);
    });
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === "string" && v in repl) obj[key] = repl[v];
      else if (v && typeof v === "object") replacePlaceholders(v, repl);
    }
  }
}

export async function runComfy(input: EditInput): Promise<EditOutput> {
  // Open the progress socket up front so ComfyUI routes this job's step events
  // (keyed by client_id "slika-ai") to it for /api/progress to report.
  ensureComfyWs();

  const isBrush = input.mode === "brush" && !!input.mask;
  const wfPath = isBrush ? INPAINT_WORKFLOW : EDIT_WORKFLOW;

  let workflow: ComfyWorkflow;
  try {
    const raw = await readFile(path.join(process.cwd(), wfPath), "utf8");
    workflow = JSON.parse(raw) as ComfyWorkflow;
  } catch {
    throw new Error(`Could not read ComfyUI workflow at ${wfPath}`);
  }

  // Strip annotation keys (e.g. "_comment") — ComfyUI treats every top-level
  // key as a node and 500s on anything without a class_type.
  for (const key of Object.keys(workflow)) {
    if (key.startsWith("_")) delete workflow[key];
  }

  const imageName = await uploadImage(input.image, "slika-input.png");
  const repl: Record<string, string | number> = {
    __PROMPT__: input.prompt,
    __IMAGE__: imageName,
    // Node runtime — Math.random is allowed here (unlike workflow scripts).
    __SEED__: Math.floor(Math.random() * 1_000_000_000_000),
  };
  if (isBrush && input.mask) {
    repl.__MASK__ = await uploadImage(input.mask, "slika-mask.png");
  }
  replacePlaceholders(workflow, repl);

  const queue = await fetch(`${COMFY}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: "slika-ai" }),
  });
  if (!queue.ok) {
    throw new Error(`ComfyUI queue failed: ${queue.status} ${await queue.text()}`);
  }
  const { prompt_id: promptId } = (await queue.json()) as { prompt_id: string };

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const h = await fetch(`${COMFY}/history/${promptId}`);
    if (h.ok) {
      const hist = (await h.json()) as Record<
        string,
        {
          status?: { status_str?: string };
          outputs?: Record<
            string,
            { images?: Array<{ filename: string; subfolder?: string; type?: string }> }
          >;
        }
      >;
      const entry = hist[promptId];
      if (entry?.status?.status_str === "error") {
        throw new Error("ComfyUI reported an execution error");
      }
      if (entry?.outputs) {
        for (const nodeId of Object.keys(entry.outputs)) {
          const images = entry.outputs[nodeId].images;
          if (images && images.length) {
            const img = images[images.length - 1];
            const url =
              `${COMFY}/view?filename=${encodeURIComponent(img.filename)}` +
              `&subfolder=${encodeURIComponent(img.subfolder || "")}` +
              `&type=${encodeURIComponent(img.type || "output")}`;
            const r = await fetch(url);
            if (!r.ok) throw new Error(`ComfyUI view failed: ${r.status}`);
            const ab = await r.arrayBuffer();
            const b64 = Buffer.from(ab).toString("base64");
            return { imageUrl: `data:image/png;base64,${b64}` };
          }
        }
      }
    }
    await new Promise((res) => setTimeout(res, 1200));
  }
  throw new Error("ComfyUI timed out waiting for a result");
}
