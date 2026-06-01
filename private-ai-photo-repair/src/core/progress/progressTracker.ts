import type { RetouchTask } from "../models/types";
import type {
  ProcessingProgress,
  ProcessingStep,
  ProcessingStatus,
} from "./progressTypes";
import { buildSteps, computeOverallPercentage } from "./progressUtils";

export type ProgressListener = (progress: ProcessingProgress) => void;

/**
 * Drives a ProcessingProgress object as pipeline steps execute and notifies a
 * listener. UI throttling is handled by the consumer; this just emits state.
 */
export class ProgressTracker {
  private progress: ProcessingProgress;
  private readonly listener: ProgressListener;

  constructor(taskId: string, taskType: RetouchTask, listener: ProgressListener) {
    this.listener = listener;
    this.progress = {
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

  private emit(): void {
    this.progress.overallPercentage = computeOverallPercentage(this.progress.steps);
    // Emit a shallow clone so consumers can store snapshots safely.
    this.listener({
      ...this.progress,
      steps: this.progress.steps.map((s) => ({ ...s })),
    });
  }

  private findStep(id: string): ProcessingStep | undefined {
    return this.progress.steps.find((s) => s.id === id);
  }

  start(): void {
    this.progress.status = "running";
    this.progress.startedAt = Date.now();
    this.progress.currentMessage = "Starting…";
    this.emit();
  }

  startStep(id: string, message?: string): void {
    const step = this.findStep(id);
    if (!step) return;
    step.status = "running";
    step.startedAt = Date.now();
    this.progress.currentStepId = id;
    this.progress.currentMessage = message ?? step.description;
    this.emit();
  }

  /** Update only the current message (e.g. tile updates) without step change. */
  message(message: string): void {
    this.progress.currentMessage = message;
    this.emit();
  }

  completeStep(id: string, message?: string): void {
    const step = this.findStep(id);
    if (!step) return;
    step.status = "completed";
    step.completedAt = Date.now();
    step.durationMs = step.startedAt ? step.completedAt - step.startedAt : null;
    if (message) this.progress.currentMessage = message;
    this.emit();
  }

  skipStep(id: string): void {
    const step = this.findStep(id);
    if (!step) return;
    step.status = "skipped";
    step.completedAt = Date.now();
    step.durationMs = 0;
    this.emit();
  }

  /** Convenience: complete previous running step (if any) then start the next. */
  advanceTo(id: string, message?: string): void {
    const running = this.progress.steps.find((s) => s.status === "running");
    if (running && running.id !== id) {
      this.completeStep(running.id);
    }
    this.startStep(id, message);
  }

  finish(): void {
    for (const step of this.progress.steps) {
      if (step.status === "running") this.completeStep(step.id);
    }
    this.progress.status = "completed";
    this.progress.completedAt = Date.now();
    this.progress.totalDurationMs = this.progress.startedAt
      ? this.progress.completedAt - this.progress.startedAt
      : null;
    this.progress.currentMessage = "Done.";
    this.progress.currentStepId = null;
    this.emit();
  }

  fail(error: string): void {
    const running = this.progress.steps.find((s) => s.status === "running");
    if (running) {
      running.status = "failed";
      running.completedAt = Date.now();
      running.durationMs = running.startedAt
        ? running.completedAt - running.startedAt
        : null;
    }
    this.setTerminal("failed", error, `Processing failed: ${error}`);
  }

  cancel(): void {
    this.setTerminal("cancelled", undefined, "Processing cancelled.");
  }

  private setTerminal(status: ProcessingStatus, error: string | undefined, message: string): void {
    this.progress.status = status;
    this.progress.completedAt = Date.now();
    this.progress.totalDurationMs = this.progress.startedAt
      ? this.progress.completedAt - this.progress.startedAt
      : null;
    this.progress.currentMessage = message;
    if (error) this.progress.error = error;
    this.emit();
  }

  snapshot(): ProcessingProgress {
    return {
      ...this.progress,
      steps: this.progress.steps.map((s) => ({ ...s })),
    };
  }
}
