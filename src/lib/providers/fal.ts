import { fal } from "@fal-ai/client";
import type { EditInput, EditOutput } from "./types";

const EDIT_MODEL = process.env.FAL_EDIT_MODEL || "fal-ai/flux-pro/kontext";
const INPAINT_MODEL = process.env.FAL_INPAINT_MODEL || "fal-ai/flux-pro/v1/fill";

type FalResult = { data?: { images?: Array<{ url?: string }> } };

export async function runFal(input: EditInput): Promise<EditOutput> {
  if (!process.env.FAL_KEY) {
    throw new Error("FAL_KEY is not configured");
  }
  fal.config({ credentials: process.env.FAL_KEY });

  const imageUrl = await fal.storage.upload(input.image);

  let result: FalResult;
  if (input.mode === "brush" && input.mask) {
    const maskUrl = await fal.storage.upload(input.mask);
    result = (await fal.subscribe(INPAINT_MODEL, {
      input: { image_url: imageUrl, mask_url: maskUrl, prompt: input.prompt },
      logs: false,
    })) as FalResult;
  } else {
    result = (await fal.subscribe(EDIT_MODEL, {
      input: { prompt: input.prompt, image_url: imageUrl },
      logs: false,
    })) as FalResult;
  }

  const url = result.data?.images?.[0]?.url;
  if (!url) throw new Error("fal returned no image");
  return { imageUrl: url };
}
