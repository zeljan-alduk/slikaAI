import type { ModelRegistryEntry } from "../core/models/types";
import type { PipelinePlan } from "../core/inference/pipelineFactory";
import { formatBytes } from "../core/progress/formatters";

interface ModelRequirementCardProps {
  model: ModelRegistryEntry | null;
  plan: PipelinePlan | null;
  cached: boolean;
  freeStorageBytes: number | null;
  onDownload: () => void;
  disabled?: boolean;
}

export function ModelRequirementCard({
  model,
  plan,
  cached,
  freeStorageBytes,
  onDownload,
  disabled,
}: ModelRequirementCardProps): JSX.Element | null {
  if (!model || !plan) return null;

  const sizeBytes = model.estimatedSizeMb * 1024 * 1024;
  const insufficientStorage =
    freeStorageBytes !== null && !cached && freeStorageBytes < sizeBytes;
  const afterInstall =
    freeStorageBytes !== null ? Math.max(0, freeStorageBytes - sizeBytes) : null;

  if (plan.useMock) {
    return (
      <section className="card">
        <div className="row spread">
          <h2>AI model</h2>
          <span className="badge warn">Mock mode</span>
        </div>
        <p className="muted">
          {model.modelUrl
            ? "No real inference backend is available, so this task runs in mock mode."
            : "No real model URL is configured for this task, so it runs in mock mode."}{" "}
          Results are simulated and clearly labelled. No download is required.
        </p>
        <div className="kv-grid" style={{ marginTop: 8 }}>
          <div className="kv">
            <span className="k">Model</span>
            <span className="v">{model.name}</span>
          </div>
          <div className="kv">
            <span className="k">Version</span>
            <span className="v">{model.version}</span>
          </div>
        </div>
      </section>
    );
  }

  if (cached) {
    return (
      <section className="card">
        <div className="row spread">
          <h2>AI model</h2>
          <span className="badge success">Ready on device</span>
        </div>
        <p className="muted">
          “{model.name}” (v{model.version}) is stored locally and will be reused.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>AI Model Required</h2>
      <p className="muted">
        To process photos directly on this device, this AI model must be
        downloaded once.
      </p>
      <ul className="privacy" style={{ marginTop: 4, paddingLeft: 18 }}>
        <li>Downloaded only once</li>
        <li>Stored locally on your device</li>
        <li>Reused next time</li>
        <li>Can be deleted at any time</li>
        <li>Your photos stay on this device</li>
      </ul>

      <div className="kv-grid" style={{ marginTop: 12 }}>
        <div className="kv">
          <span className="k">Model name</span>
          <span className="v">{model.name}</span>
        </div>
        <div className="kv">
          <span className="k">Version</span>
          <span className="v">{model.version}</span>
        </div>
        <div className="kv">
          <span className="k">Model size</span>
          <span className="v">{formatBytes(sizeBytes)}</span>
        </div>
        <div className="kv">
          <span className="k">Storage available</span>
          <span className="v">
            {freeStorageBytes !== null ? formatBytes(freeStorageBytes) : "Unknown"}
          </span>
        </div>
        <div className="kv">
          <span className="k">Estimated space after install</span>
          <span className="v">
            {afterInstall !== null ? formatBytes(afterInstall) : "Unknown"}
          </span>
        </div>
      </div>

      {insufficientStorage && (
        <p className="muted" style={{ color: "var(--warn)", marginTop: 10 }}>
          ⚠ Not enough free browser storage is available for this model. You can
          delete installed models or choose a smaller task.
        </p>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={onDownload}
          disabled={disabled || insufficientStorage}
        >
          Download Model
        </button>
      </div>
    </section>
  );
}
