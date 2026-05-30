import WebSocket from "ws";

// Tracks the live progress of the currently running ComfyUI job by listening on
// ComfyUI's WebSocket. ComfyUI routes execution messages to the socket whose
// clientId matches the prompt's client_id — so we connect with the SAME id the
// provider uses ("slika-ai"). A single connection is kept alive on globalThis so
// it survives Next.js hot-reloads and is shared across requests.

const CLIENT_ID = "slika-ai";

export type ComfyProgress = {
  value: number; // current sampler step
  max: number; // total steps
  node: string | null;
  promptId: string | null;
  running: boolean;
  ts: number; // last update (ms)
};

type Store = { ws: WebSocket | null; progress: ComfyProgress };

function store(): Store {
  const g = globalThis as unknown as { __slikaComfy?: Store };
  if (!g.__slikaComfy) {
    g.__slikaComfy = {
      ws: null,
      progress: { value: 0, max: 0, node: null, promptId: null, running: false, ts: 0 },
    };
  }
  return g.__slikaComfy;
}

function wsUrl(): string {
  const base = (process.env.COMFYUI_URL || "http://127.0.0.1:8000")
    .replace(/^http/, "ws")
    .replace(/\/+$/, "");
  return `${base}/ws?clientId=${CLIENT_ID}`;
}

export function ensureComfyWs(): void {
  const s = store();
  if (
    s.ws &&
    (s.ws.readyState === WebSocket.OPEN || s.ws.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }
  try {
    const ws = new WebSocket(wsUrl());
    s.ws = ws;
    ws.on("message", (raw: WebSocket.RawData) => {
      let msg: { type?: string; data?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const d = msg.data || {};
      const p = s.progress;
      switch (msg.type) {
        case "execution_start":
          s.progress = {
            value: 0,
            max: 0,
            node: null,
            promptId: (d.prompt_id as string) ?? null,
            running: true,
            ts: Date.now(),
          };
          break;
        case "progress":
          s.progress = {
            value: (d.value as number) ?? 0,
            max: (d.max as number) ?? 0,
            node: (d.node as string) ?? p.node,
            promptId: (d.prompt_id as string) ?? p.promptId,
            running: true,
            ts: Date.now(),
          };
          break;
        case "executing":
          s.progress = {
            ...p,
            node: (d.node as string) ?? null,
            running: d.node !== null,
            ts: Date.now(),
          };
          break;
        case "execution_error":
        case "execution_success":
          s.progress = { ...p, running: false, ts: Date.now() };
          break;
      }
    });
    ws.on("close", () => {
      if (s.ws === ws) s.ws = null;
    });
    ws.on("error", () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (s.ws === ws) s.ws = null;
    });
  } catch {
    s.ws = null;
  }
}

export function getComfyProgress(): ComfyProgress {
  return store().progress;
}
