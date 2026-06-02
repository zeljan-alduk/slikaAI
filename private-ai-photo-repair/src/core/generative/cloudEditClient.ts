import { cloudEndpoint } from "./engineSelector";

/**
 * Cloud generative-edit client.
 *
 * This is the *opt-in* path for generative editing: the image is uploaded to a
 * configured editing endpoint (default contract matches this repo's Next.js
 * `/api/edit` route, which fronts FLUX Kontext via fal / ComfyUI). It is only
 * ever called after the user has explicitly consented, because — unlike every
 * other task in this app — the photo leaves the device.
 */

export class CloudEditCancelledError extends Error {
  constructor() {
    super("Cloud edit cancelled.");
    this.name = "CloudEditCancelledError";
  }
}

export class CloudEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudEditError";
  }
}

export interface CloudEditParams {
  image: Blob;
  prompt: string;
  /** Used by the endpoint to translate non-English prompts (FLUX is EN-centric). */
  locale?: string;
  imageW?: number;
  imageH?: number;
  signal?: AbortSignal;
  /** Coarse status messages for the UI (the endpoint is a black box). */
  onStatus?: (message: string) => void;
}

export interface CloudEditResult {
  blob: Blob;
  mimeType: string;
  /** The (possibly translated) prompt the model actually used, if reported. */
  promptUsed?: string;
}

interface EditApiResponse {
  imageUrl?: string;
  promptUsed?: string;
  error?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  needImage: "The cloud endpoint did not receive a valid image.",
  needPrompt: "Enter a prompt describing the edit.",
  tooBig: "The image is too large for the cloud endpoint (max 20 MB).",
  engineOffline: "The cloud editing engine is not running or unreachable.",
  generic: "The cloud editing endpoint returned an error.",
};

function describeError(body: EditApiResponse | null, status: number): string {
  const code = body?.error;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]!;
  if (status === 503) return ERROR_MESSAGES.engineOffline!;
  if (status === 413) return ERROR_MESSAGES.tooBig!;
  return ERROR_MESSAGES.generic!;
}

/**
 * Send the image + prompt to the configured cloud endpoint and return the
 * edited image as a Blob. Throws CloudEditError on failure and
 * CloudEditCancelledError when aborted.
 */
export async function runCloudEdit(params: CloudEditParams): Promise<CloudEditResult> {
  const endpoint = cloudEndpoint();
  if (!endpoint) {
    throw new CloudEditError("No cloud editing endpoint is configured.");
  }
  if (params.signal?.aborted) throw new CloudEditCancelledError();

  const form = new FormData();
  form.set("image", params.image, "image.png");
  form.set("prompt", params.prompt);
  form.set("mode", "whole");
  form.set("quality", "standard");
  form.set("locale", params.locale ?? "en");
  if (params.imageW) form.set("imageW", String(params.imageW));
  if (params.imageH) form.set("imageH", String(params.imageH));

  params.onStatus?.("Uploading image to the cloud editing endpoint…");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: form,
      signal: params.signal,
    });
  } catch (err) {
    if (params.signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw new CloudEditCancelledError();
    }
    throw new CloudEditError(
      "Could not reach the cloud editing endpoint. Check the endpoint URL and your connection.",
    );
  }

  let body: EditApiResponse | null = null;
  try {
    body = (await response.clone().json()) as EditApiResponse;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.imageUrl) {
    throw new CloudEditError(describeError(body, response.status));
  }

  params.onStatus?.("Downloading the edited image…");
  let imageResp: Response;
  try {
    imageResp = await fetch(body.imageUrl, { signal: params.signal });
  } catch (err) {
    if (params.signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw new CloudEditCancelledError();
    }
    throw new CloudEditError("Could not download the edited image from the cloud endpoint.");
  }
  if (!imageResp.ok) {
    throw new CloudEditError("Could not download the edited image from the cloud endpoint.");
  }

  const blob = await imageResp.blob();
  return {
    blob,
    mimeType: blob.type || "image/png",
    promptUsed: body.promptUsed,
  };
}
