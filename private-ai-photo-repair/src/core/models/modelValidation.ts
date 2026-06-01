import type { ModelRegistryEntry } from "./types";

/** Compute a SHA-256 hex digest of binary data using SubtleCrypto. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

export interface ValidationResult {
  valid: boolean;
  computedHash?: string;
  error?: string;
}

/**
 * Validate a downloaded model blob. If the registry entry declares an expected
 * hash, verify it; otherwise perform sanity checks (non-empty, plausible size).
 */
export async function validateModelBlob(
  model: ModelRegistryEntry,
  blob: Blob,
): Promise<ValidationResult> {
  if (blob.size === 0) {
    return { valid: false, error: "Downloaded model is empty." };
  }

  // Guard against accidental HTML error pages served instead of the model.
  if (blob.type.startsWith("text/html")) {
    return {
      valid: false,
      error: "Downloaded content looks like an HTML page, not a model file.",
    };
  }

  if (model.hashSha256) {
    const buffer = await blob.arrayBuffer();
    const computedHash = await sha256Hex(buffer);
    if (computedHash.toLowerCase() !== model.hashSha256.toLowerCase()) {
      return {
        valid: false,
        computedHash,
        error: "Model hash does not match the expected value.",
      };
    }
    return { valid: true, computedHash };
  }

  return { valid: true };
}
