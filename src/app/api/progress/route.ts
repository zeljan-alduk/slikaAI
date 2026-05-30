import { NextResponse } from "next/server";
import { activeProvider } from "@/lib/providers";
import { ensureComfyWs, getComfyProgress } from "@/lib/comfyProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Only ComfyUI exposes step-level progress. Others fall back to a timer UI.
  if (activeProvider() !== "comfyui") {
    return NextResponse.json({ available: false });
  }

  ensureComfyWs();
  const p = getComfyProgress();
  const percent = p.max > 0 ? Math.min(100, Math.round((p.value / p.max) * 100)) : 0;

  return NextResponse.json({
    available: true,
    value: p.value,
    max: p.max,
    percent,
    node: p.node,
    running: p.running,
    ts: p.ts,
  });
}
