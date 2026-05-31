import { NextRequest, NextResponse } from "next/server";
import { runEdit, type EditMode, type Quality } from "@/lib/providers";
import { activeProvider, EngineOfflineError } from "@/lib/providers";
import { translateToEnglish } from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }

  const image = form.get("image");
  const mask = form.get("mask");
  const prompt = (form.get("prompt") as string | null)?.trim();
  const locale = (form.get("locale") as string | null) ?? "en";
  const qIn = form.get("quality") as string | null;
  const quality: Quality =
    qIn === "fast" || qIn === "high" ? qIn : "standard";
  const mode: EditMode =
    (form.get("mode") as string | null) === "brush" ? "brush" : "whole";

  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: "needImage" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "needPrompt" }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: "tooBig" }, { status: 413 });
  }
  if (mode === "brush" && !(mask instanceof Blob)) {
    return NextResponse.json({ error: "needMask" }, { status: 400 });
  }

  try {
    // FLUX Kontext is English-centric — translate non-English prompts first.
    // Skip for mock (it ignores the prompt anyway).
    let promptForModel = prompt;
    let translatedFrom: string | undefined;
    if (activeProvider() !== "mock") {
      const tr = await translateToEnglish(prompt, locale);
      promptForModel = tr.text;
      if (tr.translated) translatedFrom = tr.original;
    }

    const result = await runEdit({
      image,
      mask: mask instanceof Blob ? mask : null,
      prompt: promptForModel,
      mode,
      quality,
    });
    return NextResponse.json({ ...result, promptUsed: promptForModel, translatedFrom });
  } catch (err) {
    console.error("[edit] provider error", err);
    if (err instanceof EngineOfflineError) {
      return NextResponse.json({ error: "engineOffline" }, { status: 503 });
    }
    return NextResponse.json({ error: "generic" }, { status: 502 });
  }
}
