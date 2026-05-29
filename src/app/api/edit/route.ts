import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const EDIT_MODEL = process.env.FAL_EDIT_MODEL || "fal-ai/flux-pro/kontext";
const INPAINT_MODEL = process.env.FAL_INPAINT_MODEL || "fal-ai/flux-pro/v1/fill";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

type FalResult = {
  data?: { images?: Array<{ url?: string }> };
};

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "noKey" }, { status: 503 });
  }

  fal.config({ credentials: process.env.FAL_KEY });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }

  const image = form.get("image");
  const mask = form.get("mask");
  const prompt = (form.get("prompt") as string | null)?.trim();
  const mode = (form.get("mode") as string | null) === "brush" ? "brush" : "whole";

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
    const imageUrl = await fal.storage.upload(image);

    let result: FalResult;
    if (mode === "brush" && mask instanceof Blob) {
      const maskUrl = await fal.storage.upload(mask);
      result = (await fal.subscribe(INPAINT_MODEL, {
        input: { image_url: imageUrl, mask_url: maskUrl, prompt },
        logs: false,
      })) as FalResult;
    } else {
      result = (await fal.subscribe(EDIT_MODEL, {
        input: { prompt, image_url: imageUrl },
        logs: false,
      })) as FalResult;
    }

    const url = result.data?.images?.[0]?.url;
    if (!url) {
      return NextResponse.json({ error: "generic" }, { status: 502 });
    }

    return NextResponse.json({ imageUrl: url });
  } catch (err) {
    console.error("[edit] fal error", err);
    return NextResponse.json({ error: "generic" }, { status: 502 });
  }
}
