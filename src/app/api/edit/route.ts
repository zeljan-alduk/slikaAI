import { NextRequest, NextResponse } from "next/server";
import { runEdit, type EditMode } from "@/lib/providers";

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
    const result = await runEdit({
      image,
      mask: mask instanceof Blob ? mask : null,
      prompt,
      mode,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[edit] provider error", err);
    return NextResponse.json({ error: "generic" }, { status: 502 });
  }
}
