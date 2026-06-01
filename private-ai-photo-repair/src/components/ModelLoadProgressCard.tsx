import type { ModelLoadProgress } from "../core/models/types";
import { ProgressBar } from "./ProgressBar";
import { backendLabel } from "../core/capabilities/deviceTier";

interface ModelLoadProgressCardProps {
  progress: ModelLoadProgress | null;
}

export function ModelLoadProgressCard({ progress }: ModelLoadProgressCardProps): JSX.Element | null {
  if (!progress || progress.status === "idle") return null;
  return (
    <section className="card">
      <div className="row spread">
        <h2>Loading model</h2>
        <span className="badge">{backendLabel(progress.backend)}</span>
      </div>
      <ProgressBar percentage={progress.percentage} />
      <p className="muted" style={{ marginTop: 8 }}>{progress.message}</p>
      {progress.error && (
        <p className="muted" style={{ color: "var(--danger)" }}>{progress.error}</p>
      )}
    </section>
  );
}
