import type { DeviceTier } from "../capabilities/types";
import type { RetouchTask } from "./types";
import type { ModelRegistryEntry } from "./types";
import { MODEL_REGISTRY } from "./modelRegistry";

const TIER_RANK: Record<DeviceTier, number> = {
  unsupported: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export interface ModelSelection {
  model: ModelRegistryEntry | null;
  meetsTier: boolean;
  warnings: string[];
}

/**
 * Pick the registry entry that implements a task, and flag whether the device
 * tier meets the model's minimum requirement (the app still allows mock runs on
 * weaker devices, but warns).
 */
export function selectModelForTask(
  task: RetouchTask,
  tier: DeviceTier,
): ModelSelection {
  const warnings: string[] = [];

  if (task === "unknown") {
    return {
      model: null,
      meetsTier: false,
      warnings: ["No task was recognised from the prompt. Pick a suggested command."],
    };
  }

  const model = MODEL_REGISTRY.find((m) => m.task === task && m.enabled) ?? null;
  if (!model) {
    return {
      model: null,
      meetsTier: false,
      warnings: [`No model is registered for the "${task}" task.`],
    };
  }

  const meetsTier = TIER_RANK[tier] >= TIER_RANK[model.minimumTier];
  if (!meetsTier) {
    warnings.push(
      `This task recommends a ${model.minimumTier}-tier device. Your device is ${tier} tier; results may be slow or limited.`,
    );
  }

  return { model, meetsTier, warnings };
}
