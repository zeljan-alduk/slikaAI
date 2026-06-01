import type { ProcessingProgress } from "../core/progress/progressTypes";
import { ProgressBar } from "./ProgressBar";
import { formatDuration } from "../core/progress/formatters";

interface ProcessingTimelineProps {
  progress: ProcessingProgress | null;
  onCancel: () => void;
}

export function ProcessingTimeline({ progress, onCancel }: ProcessingTimelineProps): JSX.Element | null {
  if (!progress || progress.status === "idle") return null;
  const running = progress.status === "running";

  return (
    <section className="card">
      <div className="row spread">
        <h2>Processing</h2>
        <span className="badge">{progress.status}</span>
      </div>
      <ProgressBar percentage={progress.overallPercentage} />
      <p className="muted" style={{ marginTop: 8 }}>
        {progress.overallPercentage}% — {progress.currentMessage}
      </p>

      <div className="timeline" style={{ marginTop: 8 }}>
        {progress.steps.map((step) => (
          <div className={`step ${step.status}`} key={step.id}>
            <span className="dot" />
            <div>
              <div className="label">{step.label}</div>
              {step.durationMs !== null && step.status === "completed" && (
                <div className="meta">{formatDuration(step.durationMs / 1000)}</div>
              )}
              {step.status === "running" && <div className="meta">{step.description}</div>}
            </div>
          </div>
        ))}
      </div>

      {running && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small danger" onClick={onCancel}>
            Cancel processing
          </button>
        </div>
      )}
    </section>
  );
}
