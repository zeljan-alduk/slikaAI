import type { WorkerReferenceInput } from "../inference/types";

export interface ReferenceAnalysis {
  id: string;
  qualityScore: number;
  sharpness: number;
  brightness: number;
  faceDetected: boolean;
  referenceType: WorkerReferenceInput["referenceType"];
}

/**
 * Estimate sharpness via mean absolute Laplacian on the luminance channel.
 * Higher means crisper. Sampled for performance on large images.
 */
function estimateSharpness(data: ImageData): number {
  const { width, height, data: px } = data;
  if (width < 3 || height < 3) return 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 256));
  let sum = 0;
  let count = 0;
  const lum = (x: number, y: number): number => {
    const i = (y * width + x) * 4;
    return 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
  };
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const laplacian =
        4 * lum(x, y) -
        lum(x - step, y) -
        lum(x + step, y) -
        lum(x, y - step) -
        lum(x, y + step);
      sum += Math.abs(laplacian);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function estimateBrightness(data: ImageData): number {
  const { data: px } = data;
  const step = 4 * Math.max(1, Math.floor(px.length / 4 / 4096));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < px.length; i += step) {
    sum += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Mock face detection. We do not ship a real face model in the MVP, so this is
 * a heuristic placeholder (skin-tone fraction) that yields a deterministic
 * boolean for UI flow. It is clearly not identity-aware.
 */
function mockDetectFace(data: ImageData): boolean {
  const { data: px } = data;
  const step = 4 * Math.max(1, Math.floor(px.length / 4 / 8192));
  let skin = 0;
  let count = 0;
  for (let i = 0; i < px.length; i += step) {
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15) {
      skin += 1;
    }
    count += 1;
  }
  return count > 0 && skin / count > 0.08;
}

export function analyzeReference(ref: WorkerReferenceInput): ReferenceAnalysis {
  const sharpness = estimateSharpness(ref.imageData);
  const brightness = estimateBrightness(ref.imageData);
  // Brightness sweet spot ~ 128; penalise very dark/blown-out images.
  const brightnessScore = 1 - Math.min(1, Math.abs(brightness - 128) / 128);
  const sharpnessScore = Math.min(1, sharpness / 25);
  const qualityScore = Math.round((0.6 * sharpnessScore + 0.4 * brightnessScore) * 100);
  return {
    id: ref.id,
    qualityScore,
    sharpness,
    brightness,
    faceDetected: mockDetectFace(ref.imageData),
    referenceType: ref.referenceType,
  };
}

export function selectBestReference(
  analyses: ReferenceAnalysis[],
): ReferenceAnalysis | null {
  if (analyses.length === 0) return null;
  // Prefer same-person/face references with a detected face, then quality.
  const score = (a: ReferenceAnalysis): number => {
    let bonus = 0;
    if (a.referenceType === "same-person" || a.referenceType === "same-face") bonus += 40;
    if (a.faceDetected) bonus += 20;
    return a.qualityScore + bonus;
  };
  return [...analyses].sort((a, b) => score(b) - score(a))[0] ?? null;
}
