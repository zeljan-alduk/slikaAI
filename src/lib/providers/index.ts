import type { EditInput, EditOutput, ProviderName } from "./types";
import { runMock } from "./mock";
import { runFal } from "./fal";
import { runComfy } from "./comfyui";

export type { EditInput, EditOutput, EditMode, Quality, ProviderName } from "./types";
export { QUALITY_PRESETS } from "./types";
export { EngineOfflineError } from "./comfyui";

// Resolve the active provider. Explicit PROVIDER / MOCK_EDIT win; otherwise we
// auto-detect from configured credentials and fall back to free mock mode.
export function activeProvider(): ProviderName {
  if (process.env.MOCK_EDIT === "1") return "mock";

  const explicit = process.env.PROVIDER?.toLowerCase();
  if (explicit === "mock" || explicit === "fal" || explicit === "comfyui") {
    return explicit;
  }

  if (process.env.FAL_KEY) return "fal";
  if (process.env.COMFYUI_URL) return "comfyui";
  return "mock";
}

export async function runEdit(input: EditInput): Promise<EditOutput> {
  switch (activeProvider()) {
    case "fal":
      return runFal(input);
    case "comfyui":
      return runComfy(input);
    default:
      return runMock(input);
  }
}
