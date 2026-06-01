import type { RetouchTask } from "../models/types";

export type IntentStrength = "low" | "medium" | "high";

export type PromptLanguage = "hr" | "en" | "unknown";

export type ReferenceMode =
  | "same-person-face"
  | "same-scene"
  | "color-style"
  | "general-quality"
  | "none";

export interface RetouchIntent {
  task: RetouchTask;
  strength: IntentStrength;
  language: PromptLanguage;
  usesReferenceImages: boolean;
  referenceMode: ReferenceMode;
  originalPrompt: string;
  confidence: number;
  warnings: string[];
}
