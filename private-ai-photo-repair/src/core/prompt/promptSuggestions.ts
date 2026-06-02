import type { RetouchTask } from "../models/types";

export interface SuggestedCommand {
  label: string;
  prompt: string;
  task: RetouchTask;
  language: "hr" | "en";
}

export const SUGGESTED_COMMANDS_HR: SuggestedCommand[] = [
  { label: "Ukloni pozadinu", prompt: "ukloni pozadinu", task: "background-removal", language: "hr" },
  { label: "Poboljšaj sliku", prompt: "poboljšaj sliku", task: "enhance", language: "hr" },
  { label: "Ukloni šum", prompt: "ukloni šum", task: "denoise", language: "hr" },
  { label: "Izoštri", prompt: "izoštri sliku", task: "enhance", language: "hr" },
  { label: "Povećaj rezoluciju 2x", prompt: "povećaj rezoluciju 2x", task: "super-resolution", language: "hr" },
  { label: "Popravi staru fotografiju", prompt: "popravi staru fotografiju", task: "restore-old-photo", language: "hr" },
  { label: "Popravi lice prema referenci", prompt: "popravi lice prema referenci", task: "reference-guided-restore", language: "hr" },
  { label: "Pametni izrez: osoba", prompt: "fokusiraj na osobu", task: "smart-crop", language: "hr" },
];

export const SUGGESTED_COMMANDS_EN: SuggestedCommand[] = [
  { label: "Remove background", prompt: "remove background", task: "background-removal", language: "en" },
  { label: "Enhance photo", prompt: "enhance photo", task: "enhance", language: "en" },
  { label: "Denoise", prompt: "denoise", task: "denoise", language: "en" },
  { label: "Sharpen", prompt: "sharpen image", task: "enhance", language: "en" },
  { label: "Upscale 2x", prompt: "upscale 2x", task: "super-resolution", language: "en" },
  { label: "Restore old photo", prompt: "restore old photo", task: "restore-old-photo", language: "en" },
  { label: "Restore face using reference", prompt: "restore face using reference", task: "reference-guided-restore", language: "en" },
  { label: "Smart crop: person", prompt: "focus on the person", task: "smart-crop", language: "en" },
];

export const ALL_SUGGESTED_COMMANDS: SuggestedCommand[] = [
  ...SUGGESTED_COMMANDS_EN,
  ...SUGGESTED_COMMANDS_HR,
];
