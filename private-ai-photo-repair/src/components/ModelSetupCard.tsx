import { useMemo, useState } from "react";
import type { ModelRegistryEntry, DownloadProgress } from "../core/models/types";
import type { StartupQueueState } from "../app/AppState";
import { ProgressBar } from "./ProgressBar";
import {
  formatBytes,
  formatSpeed,
  formatDuration,
} from "../core/progress/formatters";

interface ModelSetupCardProps {
  models: ModelRegistryEntry[];
  freeStorageBytes: number | null;
  downloading: boolean;
  progress: DownloadProgress | null;
  queue: StartupQueueState | null;
  onDownload: (ids: string[]) => void;
  onCancel: () => void;
  onDismiss: (dontAskAgain: boolean) => void;
}

export function ModelSetupCard({
  models,
  freeStorageBytes,
  downloading,
  progress,
  queue,
  onDownload,
  onCancel,
  onDismiss,
}: ModelSetupCardProps): JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(models.map((m) => m.id)),
  );
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const selectedSizeBytes = useMemo(
    () =>
      models
        .filter((m) => selected.has(m.id))
        .reduce((sum, m) => sum + m.estimatedSizeMb * 1024 * 1024, 0),
    [models, selected],
  );

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (downloading) {
    const detail = (() => {
      if (!progress) return "Starting…";
      if (progress.status === "downloading") {
        const parts: string[] = [];
        parts.push(
          progress.totalBytes
            ? `${formatBytes(progress.downloadedBytes)} of ${formatBytes(progress.totalBytes)}`
            : `${formatBytes(progress.downloadedBytes)} (size unknown)`,
        );
        parts.push(formatSpeed(progress.speedBytesPerSecond));
        if (progress.estimatedSecondsRemaining !== null) {
          parts.push(`about ${formatDuration(progress.estimatedSecondsRemaining)} left`);
        }
        return parts.join(", ");
      }
      return progress.message;
    })();

    return (
      <section className="card" style={{ borderColor: "var(--accent)" }}>
        <h2>Setting up AI models</h2>
        {queue && (
          <p className="muted">
            Downloading model {Math.min(queue.completedCount + 1, queue.total)} of{" "}
            {queue.total}
            {queue.currentName ? ` — ${queue.currentName}` : ""}
          </p>
        )}
        <ProgressBar percentage={progress?.percentage ?? null} />
        <p className="muted" style={{ marginTop: 8 }}>{detail}</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small danger" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          You can keep using the app while models download. They are stored locally
          and reused next time.
        </p>
      </section>
    );
  }

  const enoughStorage =
    freeStorageBytes === null || freeStorageBytes >= selectedSizeBytes;

  return (
    <section className="card" style={{ borderColor: "var(--accent)" }}>
      <h2>Set up AI models</h2>
      <p className="muted">
        This app runs AI on your device. To use real AI tasks, the models below
        need to be downloaded <strong>once</strong>. They are stored locally,
        reused next time, and can be deleted any time. Your photos never leave
        your device. Choose which to download now — or skip and download them
        later when you first use a task.
      </p>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {models.map((model) => (
          <label
            key={model.id}
            className="ref-item"
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={selected.has(model.id)}
              onChange={() => toggle(model.id)}
              style={{ width: "auto", marginTop: 4 }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                {model.name}{" "}
                <span className="badge">{formatBytes(model.estimatedSizeMb * 1024 * 1024)}</span>
              </div>
              <div className="muted">{model.description}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="kv-grid" style={{ marginTop: 12 }}>
        <div className="kv">
          <span className="k">Selected total</span>
          <span className="v">{formatBytes(selectedSizeBytes)}</span>
        </div>
        <div className="kv">
          <span className="k">Storage available</span>
          <span className="v">
            {freeStorageBytes !== null ? formatBytes(freeStorageBytes) : "Unknown"}
          </span>
        </div>
      </div>

      {!enoughStorage && (
        <p className="muted" style={{ color: "var(--warn)", marginTop: 8 }}>
          ⚠ Not enough free browser storage for the selected models. Deselect some
          or free up space.
        </p>
      )}

      <label className="row" style={{ gap: 6, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={dontAskAgain}
          onChange={(e) => setDontAskAgain(e.target.checked)}
          style={{ width: "auto" }}
        />
        <span className="muted">Don’t ask again on startup</span>
      </label>

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={() => onDownload([...selected])}
          disabled={selected.size === 0 || !enoughStorage}
        >
          Download selected ({selected.size})
        </button>
        <button className="ghost" onClick={() => onDismiss(dontAskAgain)}>
          Not now
        </button>
      </div>
    </section>
  );
}
