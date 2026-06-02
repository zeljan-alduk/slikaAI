import type { InferenceBackend } from "../capabilities/types";

/**
 * Hybrid engine selection for the generative-edit task.
 *
 * Generative ("describe any edit") needs a diffusion-class model. There is no
 * small generative editor that runs well in a phone browser, so this task is
 * deliberately a hybrid:
 *
 *   - LOCAL  — runs entirely on-device (WebGPU). 100% private, but only viable
 *              on capable machines and only when a local model is configured.
 *   - CLOUD  — sends the image to a configured editing endpoint. Works on any
 *              device including phones, but the image LEAVES the device, so it
 *              is strictly opt-in and requires explicit consent.
 *
 * When neither a real local model nor a consented cloud endpoint is available,
 * the app still produces a clearly-labelled, on-device *simulated* result via
 * the mock pipeline (consistent with every other task in this MVP).
 */

export type GenerativeEngine = "local" | "cloud";

/** User preference. "auto" lets the app pick the best available engine. */
export type EnginePreference = "auto" | "local" | "cloud";

export type GenerativePrivacy = "on-device" | "leaves-device";

export interface GenerativeEngineConfig {
  /** A real local generative model URL is configured (VITE_GENERATIVE_EDIT_MODEL_URL). */
  localModelConfigured: boolean;
  /** A cloud editing endpoint is configured (VITE_CLOUD_EDIT_ENDPOINT). */
  cloudEndpointConfigured: boolean;
  /** Mock pipelines are enabled (VITE_ENABLE_MOCK_MODE). */
  mockEnabled: boolean;
}

export interface GenerativeEngineContext {
  preference: EnginePreference;
  deviceBackend: InferenceBackend;
  webgpuSupported: boolean;
  /** The user explicitly agreed that, for cloud edits, the image leaves the device. */
  cloudConsented: boolean;
  config: GenerativeEngineConfig;
}

export interface GenerativeEngineDecision {
  /** The chosen engine, or null when the task cannot run with the current setup. */
  engine: GenerativeEngine | null;
  /** True only when a real (non-mock) local model will be used. */
  usesRealModel: boolean;
  privacy: GenerativePrivacy;
  /** Whether the result will be a clearly-labelled simulated (mock) edit. */
  simulated: boolean;
  /** Human-readable explanation of the decision (for UI + diagnostics). */
  reason: string;
  /** Why cloud was not auto-chosen, when relevant (e.g. needs consent). */
  blockedReason?: string;
}

/** A real on-device generative model can run (needs WebGPU + a configured model). */
function localRealPossible(ctx: GenerativeEngineContext): boolean {
  return ctx.config.localModelConfigured && ctx.webgpuSupported;
}

/** A simulated on-device result can always run when mock mode is enabled. */
function localMockPossible(ctx: GenerativeEngineContext): boolean {
  return ctx.config.mockEnabled && ctx.deviceBackend !== "unsupported";
}

/** Cloud editing can run when an endpoint is configured AND the user consented. */
function cloudPossible(ctx: GenerativeEngineContext): boolean {
  return ctx.config.cloudEndpointConfigured && ctx.cloudConsented;
}

function localDecision(ctx: GenerativeEngineContext): GenerativeEngineDecision {
  if (localRealPossible(ctx)) {
    return {
      engine: "local",
      usesRealModel: true,
      privacy: "on-device",
      simulated: false,
      reason: "Running the generative edit locally on WebGPU. Your photo never leaves the device.",
    };
  }
  if (localMockPossible(ctx)) {
    return {
      engine: "local",
      usesRealModel: false,
      privacy: "on-device",
      simulated: true,
      reason:
        "No local generative model is configured (or WebGPU is unavailable), so this runs as a clearly-labelled on-device simulation.",
    };
  }
  return {
    engine: null,
    usesRealModel: false,
    privacy: "on-device",
    simulated: false,
    reason: "Generative editing cannot run locally on this device with the current configuration.",
  };
}

function cloudDecision(ctx: GenerativeEngineContext): GenerativeEngineDecision {
  if (cloudPossible(ctx)) {
    return {
      engine: "cloud",
      usesRealModel: true,
      privacy: "leaves-device",
      simulated: false,
      reason: "Running the generative edit via the configured cloud endpoint. Your photo leaves the device for this edit.",
    };
  }
  const blockedReason = !ctx.config.cloudEndpointConfigured
    ? "No cloud editing endpoint is configured (VITE_CLOUD_EDIT_ENDPOINT)."
    : "Cloud editing requires explicit consent because the image leaves your device.";
  return {
    engine: null,
    usesRealModel: false,
    privacy: "leaves-device",
    simulated: false,
    reason: "Cloud editing is not available.",
    blockedReason,
  };
}

/**
 * Decide which generative engine to use. Pure and deterministic so it can be
 * reasoned about and tested without a browser.
 */
export function selectGenerativeEngine(
  ctx: GenerativeEngineContext,
): GenerativeEngineDecision {
  if (ctx.preference === "local") return localDecision(ctx);
  if (ctx.preference === "cloud") return cloudDecision(ctx);

  // Auto: prefer a real on-device model (best privacy + real result); then a
  // consented cloud endpoint (real result, leaves device); then on-device mock.
  if (localRealPossible(ctx)) return localDecision(ctx);
  if (cloudPossible(ctx)) return cloudDecision(ctx);

  const local = localDecision(ctx);
  if (local.engine) {
    // On-device simulation is available. Note if cloud could upgrade it.
    if (ctx.config.cloudEndpointConfigured && !ctx.cloudConsented) {
      return {
        ...local,
        blockedReason:
          "A cloud endpoint is available for a real generative edit — enable it and consent to use it.",
      };
    }
    return local;
  }
  // Nothing local; surface the cloud blocker as the actionable path.
  return cloudDecision(ctx);
}

/** Read the generative-edit configuration from Vite env vars. */
export function readGenerativeConfig(): GenerativeEngineConfig {
  const env = import.meta.env;
  const has = (v: string | undefined): boolean => !!v && v.trim().length > 0;
  return {
    localModelConfigured: has(env.VITE_GENERATIVE_EDIT_MODEL_URL),
    cloudEndpointConfigured: has(env.VITE_CLOUD_EDIT_ENDPOINT),
    mockEnabled: (env.VITE_ENABLE_MOCK_MODE ?? "true").toLowerCase() !== "false",
  };
}

export function cloudEndpoint(): string | null {
  const v = import.meta.env.VITE_CLOUD_EDIT_ENDPOINT;
  return v && v.trim().length > 0 ? v.trim() : null;
}
