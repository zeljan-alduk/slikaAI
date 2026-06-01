import { useMemo, useState } from "react";
import type { ModelRegistryEntry, DownloadProgress } from "../core/models/types";
import type { StartupQueueState } from "../app/AppState";
import { ProgressBar } from "./ProgressBar";
import {
  formatBytes,
  formatSpeed,
  formatDuration,
} from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";

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
  const { t } = useI18n();
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
      if (!progress) return t("setup.starting");
      if (progress.status === "downloading") {
        const parts: string[] = [];
        parts.push(
          progress.totalBytes
            ? `${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`
            : formatBytes(progress.downloadedBytes),
        );
        parts.push(formatSpeed(progress.speedBytesPerSecond));
        if (progress.estimatedSecondsRemaining !== null) {
          parts.push(formatDuration(progress.estimatedSecondsRemaining));
        }
        return parts.join(", ");
      }
      return progress.message;
    })();

    return (
      <section className="card" style={{ borderColor: "var(--accent)" }}>
        <h2>{t("setup.title")}</h2>
        {queue && (
          <p className="muted">
            {t("setup.downloadingNum", {
              current: Math.min(queue.completedCount + 1, queue.total),
              total: queue.total,
            })}
            {queue.currentName ? ` — ${queue.currentName}` : ""}
          </p>
        )}
        <ProgressBar percentage={progress?.percentage ?? null} />
        <p className="muted" style={{ marginTop: 8 }}>{detail}</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small danger" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>{t("setup.keepUsing")}</p>
      </section>
    );
  }

  const enoughStorage =
    freeStorageBytes === null || freeStorageBytes >= selectedSizeBytes;

  return (
    <section className="card" style={{ borderColor: "var(--accent)" }}>
      <h2>{t("setup.titleSelect")}</h2>
      <p className="muted">{t("setup.body")}</p>

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
          <span className="k">{t("setup.selectedTotal")}</span>
          <span className="v">{formatBytes(selectedSizeBytes)}</span>
        </div>
        <div className="kv">
          <span className="k">{t("setup.storageAvail")}</span>
          <span className="v">
            {freeStorageBytes !== null ? formatBytes(freeStorageBytes) : t("common.unknown")}
          </span>
        </div>
      </div>

      {!enoughStorage && (
        <p className="muted" style={{ color: "var(--warn)", marginTop: 8 }}>
          {t("setup.notEnough")}
        </p>
      )}

      <label className="row" style={{ gap: 6, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={dontAskAgain}
          onChange={(e) => setDontAskAgain(e.target.checked)}
          style={{ width: "auto" }}
        />
        <span className="muted">{t("setup.dontAsk")}</span>
      </label>

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={() => onDownload([...selected])}
          disabled={selected.size === 0 || !enoughStorage}
        >
          {t("setup.downloadSelected", { n: selected.size })}
        </button>
        <button className="ghost" onClick={() => onDismiss(dontAskAgain)}>
          {t("setup.notNow")}
        </button>
      </div>
    </section>
  );
}
