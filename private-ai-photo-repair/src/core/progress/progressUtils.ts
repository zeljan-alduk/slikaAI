import type { RetouchTask } from "../models/types";
import type {
  ProcessingStep,
  ProcessingProgress,
} from "./progressTypes";

interface StepTemplate {
  id: string;
  label: string;
  description: string;
  weight: number;
}

/** Generic fallback pipeline (used for unknown tasks). */
const GENERAL_STEPS: StepTemplate[] = [
  { id: "read", label: "Reading image", description: "Reading the uploaded image.", weight: 1 },
  { id: "decode", label: "Decoding image", description: "Decoding image pixels.", weight: 1 },
  { id: "resize", label: "Resizing image for this device", description: "Resizing to a safe working size.", weight: 1 },
  { id: "tensor", label: "Preparing tensor", description: "Preparing input tensor.", weight: 1 },
  { id: "load-model", label: "Loading model", description: "Ensuring the model is loaded.", weight: 1 },
  { id: "run", label: "Running local AI model", description: "Running inference locally.", weight: 3 },
  { id: "postprocess", label: "Processing model output", description: "Processing the model output.", weight: 1 },
  { id: "composite", label: "Compositing final image", description: "Compositing the final image.", weight: 1 },
  { id: "preview", label: "Preparing preview", description: "Rendering the before/after preview.", weight: 1 },
  { id: "export", label: "Export ready", description: "Result is ready to export.", weight: 1 },
];

const TASK_STEPS: Record<RetouchTask, StepTemplate[]> = {
  "background-removal": [
    { id: "decode", label: "Decode image", description: "Decoding image pixels.", weight: 1 },
    { id: "resize", label: "Resize image", description: "Resizing to a safe working size.", weight: 1 },
    { id: "normalize", label: "Normalize image tensor", description: "Normalizing pixel values.", weight: 1 },
    { id: "segment", label: "Run segmentation model", description: "Running the segmentation model.", weight: 3 },
    { id: "mask", label: "Generate alpha mask", description: "Generating the alpha mask.", weight: 1 },
    { id: "refine", label: "Refine mask edges", description: "Refining mask edges.", weight: 1 },
    { id: "composite", label: "Composite transparent PNG", description: "Compositing a transparent PNG.", weight: 1 },
    { id: "preview", label: "Render before/after preview", description: "Rendering the preview.", weight: 1 },
    { id: "export", label: "Prepare export", description: "Preparing the export.", weight: 1 },
  ],
  enhance: [
    { id: "decode", label: "Decode image", description: "Decoding image pixels.", weight: 1 },
    { id: "resize", label: "Resize image", description: "Resizing to a safe working size.", weight: 1 },
    { id: "analyze", label: "Analyze brightness/contrast/noise", description: "Analyzing the image.", weight: 1 },
    { id: "tensor", label: "Prepare tensor", description: "Preparing input tensor.", weight: 1 },
    { id: "run", label: "Run enhancement model", description: "Running the enhancement model.", weight: 3 },
    { id: "postprocess", label: "Apply detail-preserving postprocess", description: "Applying postprocessing.", weight: 1 },
    { id: "restore-size", label: "Restore target size", description: "Restoring the output size.", weight: 1 },
    { id: "preview", label: "Render before/after preview", description: "Rendering the preview.", weight: 1 },
    { id: "export", label: "Prepare export", description: "Preparing the export.", weight: 1 },
  ],
  denoise: [
    { id: "decode", label: "Decode image", description: "Decoding image pixels.", weight: 1 },
    { id: "resize", label: "Resize image", description: "Resizing to a safe working size.", weight: 1 },
    { id: "analyze", label: "Analyze brightness/contrast/noise", description: "Analyzing the image.", weight: 1 },
    { id: "tensor", label: "Prepare tensor", description: "Preparing input tensor.", weight: 1 },
    { id: "run", label: "Run enhancement model", description: "Running the denoise model.", weight: 3 },
    { id: "postprocess", label: "Apply detail-preserving postprocess", description: "Applying edge-preserving postprocess.", weight: 1 },
    { id: "restore-size", label: "Restore target size", description: "Restoring the output size.", weight: 1 },
    { id: "preview", label: "Render before/after preview", description: "Rendering the preview.", weight: 1 },
    { id: "export", label: "Prepare export", description: "Preparing the export.", weight: 1 },
  ],
  "super-resolution": [
    { id: "decode", label: "Decode image", description: "Decoding image pixels.", weight: 1 },
    { id: "memory", label: "Check memory limits", description: "Checking memory limits.", weight: 1 },
    { id: "tile", label: "Split image into tiles if needed", description: "Splitting the image into tiles.", weight: 1 },
    { id: "process-tiles", label: "Process tiles", description: "Processing tiles.", weight: 4 },
    { id: "merge", label: "Merge tiles", description: "Merging processed tiles.", weight: 1 },
    { id: "seams", label: "Remove tile seams", description: "Blending tile seams.", weight: 1 },
    { id: "preview", label: "Render before/after preview", description: "Rendering the preview.", weight: 1 },
    { id: "export", label: "Prepare export", description: "Preparing the export.", weight: 1 },
  ],
  "restore-old-photo": [
    { id: "decode", label: "Decode image", description: "Decoding image pixels.", weight: 1 },
    { id: "detect-color", label: "Detect grayscale/color image", description: "Detecting grayscale vs colour.", weight: 1 },
    { id: "analyze", label: "Analyze scratches/noise/fading", description: "Analyzing damage.", weight: 1 },
    { id: "tensor", label: "Prepare restoration tensor", description: "Preparing the restoration tensor.", weight: 1 },
    { id: "run", label: "Run restoration model", description: "Running the restoration model.", weight: 3 },
    { id: "color", label: "Run optional color correction", description: "Running colour correction.", weight: 1 },
    { id: "blend", label: "Blend restored details", description: "Blending restored details.", weight: 1 },
    { id: "preview", label: "Render before/after preview", description: "Rendering the preview.", weight: 1 },
    { id: "export", label: "Prepare export", description: "Preparing the export.", weight: 1 },
  ],
  "reference-guided-restore": [
    { id: "decode-main", label: "Decode main image", description: "Decoding the main image.", weight: 1 },
    { id: "decode-ref", label: "Decode reference images", description: "Decoding reference images.", weight: 1 },
    { id: "analyze-ref", label: "Analyze reference quality", description: "Analyzing reference quality.", weight: 1 },
    { id: "detect-main-face", label: "Detect face in main image", description: "Detecting a face in the main image.", weight: 1 },
    { id: "detect-ref-faces", label: "Detect faces in reference images", description: "Detecting faces in references.", weight: 1 },
    { id: "select-ref", label: "Select best reference image", description: "Selecting the best reference.", weight: 1 },
    { id: "extract", label: "Extract reference features", description: "Extracting reference features.", weight: 1 },
    { id: "run", label: "Run guided restoration", description: "Running guided restoration.", weight: 3 },
    { id: "blend", label: "Blend restored face/photo naturally", description: "Blending the result naturally.", weight: 1 },
    { id: "preview", label: "Render before/after preview", description: "Rendering the preview.", weight: 1 },
    { id: "export", label: "Prepare export", description: "Preparing the export.", weight: 1 },
  ],
  unknown: GENERAL_STEPS,
};

export function buildSteps(task: RetouchTask): ProcessingStep[] {
  const templates = TASK_STEPS[task] ?? GENERAL_STEPS;
  return templates.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    status: "pending",
    startedAt: null,
    completedAt: null,
    durationMs: null,
    weight: t.weight,
  }));
}

/**
 * Compute overall completion (0-100) from weighted step statuses.
 * Running steps count as half-complete so the bar advances smoothly.
 */
export function computeOverallPercentage(steps: ProcessingStep[]): number {
  const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  let done = 0;
  for (const step of steps) {
    if (step.status === "completed" || step.status === "skipped") {
      done += step.weight;
    } else if (step.status === "running") {
      done += step.weight * 0.5;
    }
  }
  return Math.min(100, Math.round((done / totalWeight) * 100));
}

export function createInitialProcessingProgress(
  taskId: string,
  taskType: RetouchTask,
): ProcessingProgress {
  return {
    taskId,
    taskType,
    status: "idle",
    overallPercentage: 0,
    currentStepId: null,
    currentMessage: "Waiting to start.",
    steps: buildSteps(taskType),
    startedAt: null,
    completedAt: null,
    totalDurationMs: null,
  };
}
