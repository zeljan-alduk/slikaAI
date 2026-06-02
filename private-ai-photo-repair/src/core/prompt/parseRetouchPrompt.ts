import type { RetouchTask } from "../models/types";
import type {
  RetouchIntent,
  IntentStrength,
  PromptLanguage,
  ReferenceMode,
} from "./promptTypes";

interface TaskRule {
  task: RetouchTask;
  keywords: string[];
}

// Keyword tables. Croatian uses normalised (diacritic-stripped) forms so that
// "obriši" matches "obrisi" too.
const TASK_RULES: TaskRule[] = [
  {
    task: "background-removal",
    keywords: [
      "remove background",
      "erase background",
      "delete background",
      "cut out",
      "transparent background",
      "ukloni pozadinu",
      "makni pozadinu",
      "obrisi pozadinu",
      "izreži pozadinu",
      "izrezi pozadinu",
      "bez pozadine",
    ],
  },
  {
    task: "super-resolution",
    keywords: [
      "upscale",
      "increase resolution",
      "higher resolution",
      "super resolution",
      "2x",
      "enlarge",
      "povecaj rezoluciju",
      "uvecaj sliku",
      "povecaj sliku",
      "veca rezolucija",
    ],
  },
  {
    task: "denoise",
    keywords: [
      "denoise",
      "remove noise",
      "reduce noise",
      "noise",
      "ukloni sum",
      "smanji sum",
      "makni sum",
    ],
  },
  {
    task: "restore-old-photo",
    keywords: [
      "restore old photo",
      "old photo",
      "remove scratches",
      "fix scratches",
      "repair old",
      "restore photograph",
      "popravi staru fotografiju",
      "stara fotografija",
      "stara slika",
      "ukloni ogrebotine",
      "ogrebotine",
      "izblijedjela",
    ],
  },
  {
    task: "reference-guided-restore",
    keywords: [
      "use these images as reference",
      "use reference",
      "make the face look like this person",
      "restore face using reference",
      "this is the same person",
      "use reference for colors",
      "fix face",
      "restore face",
      "koristi ove slike kao referencu",
      "koristi referencu",
      "lice neka slici ovoj osobi",
      "popravi lice prema referenci",
      "ovo je ista osoba",
      "koristi referencu za boje",
      "popravi lice",
    ],
  },
  {
    task: "enhance",
    keywords: [
      "enhance",
      "improve",
      "repair photo",
      "clean image",
      "clean up",
      "fix photo",
      "sharpen",
      "poboljsaj sliku",
      "poboljsaj",
      "popravi fotografiju",
      "popravi sliku",
      "ocisti sliku",
      "izostri",
      "ocisti",
    ],
  },
  // Generative editing ("describe any edit"). Deliberately last so specific
  // tasks win first; these free-form verbs are the catch-all for edits that
  // add, remove, replace or restyle content and need a diffusion-class model.
  {
    task: "generative-edit",
    keywords: [
      "add a",
      "add an",
      "add some",
      "remove the",
      "remove this",
      "replace",
      "change the",
      "change his",
      "change her",
      "turn into",
      "turn it into",
      "turn the",
      "make it look",
      "make the",
      "put a",
      "put an",
      "in the style of",
      "wearing",
      "generate",
      "dodaj",
      "zamijeni",
      "promijeni",
      "promjeni",
      "pretvori",
      "ukloni objekt",
      "makni objekt",
      "obrisi osobu",
      "ukloni osobu",
      "obuci",
      "stavi",
      "u stilu",
      "neka nosi",
    ],
  },
];

const STRENGTH_LOW = ["slight", "light", "subtle", "malo", "lagano", "njezno", "blago"];
const STRENGTH_HIGH = [
  "strong",
  "maximum",
  "max",
  "aggressive",
  "jako",
  "maksimalno",
  "agresivno",
  "snazno",
];

const REFERENCE_SAME_PERSON = [
  "same person",
  "this person",
  "same face",
  "ista osoba",
  "isto lice",
  "ovoj osobi",
  "prema referenci",
];
const REFERENCE_COLOR = [
  "for colors",
  "for color",
  "color reference",
  "za boje",
  "boje",
];
const REFERENCE_SCENE = ["same scene", "ista scena", "isti prizor"];

const HR_MARKERS = [
  "pozadinu",
  "sliku",
  "fotografiju",
  "sum",
  "izostri",
  "povecaj",
  "uvecaj",
  "staru",
  "lice",
  "osoba",
  "referencu",
  "boje",
  "ogrebotine",
  "poboljsaj",
  "ukloni",
  "makni",
  "popravi",
  "dodaj",
  "zamijeni",
  "promijeni",
  "pretvori",
  "objekt",
  "obuci",
];

function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

function normalize(input: string): string {
  return stripDiacritics(input.toLowerCase()).replace(/\s+/g, " ").trim();
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function detectLanguage(normalized: string): PromptLanguage {
  if (!normalized) return "unknown";
  const hrHit = containsAny(normalized, HR_MARKERS);
  // crude English detection: presence of common english task words
  const enHit = /\b(remove|enhance|restore|denoise|sharpen|upscale|background|photo|image|face|reference|noise|color|colour|scratches)\b/.test(
    normalized,
  );
  if (hrHit && !enHit) return "hr";
  if (enHit && !hrHit) return "en";
  if (hrHit && enHit) return "hr";
  return "unknown";
}

function detectStrength(normalized: string): IntentStrength {
  if (containsAny(normalized, STRENGTH_HIGH)) return "high";
  if (containsAny(normalized, STRENGTH_LOW)) return "low";
  return "medium";
}

function detectReferenceMode(
  normalized: string,
  task: RetouchTask,
): { mode: ReferenceMode; uses: boolean } {
  const samePerson = containsAny(normalized, REFERENCE_SAME_PERSON);
  const color = containsAny(normalized, REFERENCE_COLOR);
  const scene = containsAny(normalized, REFERENCE_SCENE);

  if (task === "reference-guided-restore") {
    if (samePerson) return { mode: "same-person-face", uses: true };
    if (color) return { mode: "color-style", uses: true };
    if (scene) return { mode: "same-scene", uses: true };
    return { mode: "general-quality", uses: true };
  }

  if (samePerson) return { mode: "same-person-face", uses: true };
  if (color) return { mode: "color-style", uses: true };
  if (scene) return { mode: "same-scene", uses: true };
  return { mode: "none", uses: false };
}

export function parseRetouchPrompt(prompt: string): RetouchIntent {
  const original = prompt;
  const normalized = normalize(prompt);
  const warnings: string[] = [];

  let task: RetouchTask = "unknown";
  let confidence = 0;

  if (normalized.length > 0) {
    for (const rule of TASK_RULES) {
      const match = rule.keywords.find((k) => normalized.includes(normalize(k)));
      if (match) {
        task = rule.task;
        // Longer, more specific matches give higher confidence.
        confidence = Math.min(0.95, 0.55 + match.length / 60);
        break;
      }
    }
  }

  const language = detectLanguage(normalized);
  const strength = detectStrength(normalized);
  const { mode, uses } = detectReferenceMode(normalized, task);

  if (task === "unknown") {
    warnings.push(
      "Could not recognise a task from the prompt. Pick a suggested command below.",
    );
  }

  if (
    uses &&
    mode !== "same-person-face" &&
    mode !== "same-scene" &&
    task === "reference-guided-restore"
  ) {
    warnings.push(
      "Reference photos may affect style/color only unless marked as the same person.",
    );
  }

  return {
    task,
    strength,
    language,
    usesReferenceImages: uses,
    referenceMode: mode,
    originalPrompt: original,
    confidence,
    warnings,
  };
}
