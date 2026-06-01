import type {
  ModelRegistryEntry,
  CachedModelInfo,
  AppSettings,
  ModelLoadProgress,
} from "../core/models/types";
import { MODEL_REGISTRY } from "../core/models/modelRegistry";
import { formatBytes } from "../core/progress/formatters";
import { ProgressBar } from "./ProgressBar";
import { useI18n } from "../i18n/i18n";

interface ModelManagerProps {
  cachedModels: CachedModelInfo[];
  transformersReady: Set<string>;
  settings: AppSettings;
  modelLoadProgress: ModelLoadProgress | null;
  busy: boolean;
  onDownload: (model: ModelRegistryEntry) => void;
  onCancelDownload: () => void;
  onDelete: (model: ModelRegistryEntry) => void;
  onRefresh: () => void;
  onDeleteAll: () => void;
  onToggleSaver: (enabled: boolean) => void;
  onSetSaverDays: (days: number) => void;
  disabled?: boolean;
}

export function ModelManager({
  cachedModels,
  transformersReady,
  settings,
  modelLoadProgress,
  busy,
  onDownload,
  onCancelDownload,
  onDelete,
  onRefresh,
  onDeleteAll,
  onToggleSaver,
  onSetSaverDays,
  disabled,
}: ModelManagerProps): JSX.Element {
  const { t } = useI18n();
  const onnxCached = new Map(cachedModels.map((c) => [c.modelId, c]));

  const isReady = (m: ModelRegistryEntry): boolean =>
    transformersReady.has(m.id) || onnxCached.has(m.id);
  const isReal = (m: ModelRegistryEntry): boolean =>
    !!m.transformersModelId || !!m.modelUrl;

  const readyCount = MODEL_REGISTRY.filter(isReady).length;
  const downloading =
    !!modelLoadProgress && modelLoadProgress.status !== "ready" && modelLoadProgress.status !== "failed";

  return (
    <details className="card collapsible">
      <summary>
        <span className="summary-title">{t("manager.title")}</span>
        <span className="badge">{readyCount}/{MODEL_REGISTRY.length}</span>
      </summary>

      <div className="row" style={{ marginBottom: 10 }}>
        <button className="small ghost" onClick={onRefresh} disabled={disabled}>
          {t("manager.checkCache")}
        </button>
      </div>

      {downloading && modelLoadProgress && (
        <div style={{ marginBottom: 12 }}>
          <ProgressBar percentage={modelLoadProgress.percentage} />
          <div className="row spread" style={{ marginTop: 6 }}>
            <span className="muted">{modelLoadProgress.message}</span>
            <button className="small danger" onClick={onCancelDownload}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MODEL_REGISTRY.map((model) => {
          const ready = isReady(model);
          const real = isReal(model);
          const cachedInfo = onnxCached.get(model.id);
          const sizeLabel = cachedInfo
            ? formatBytes(cachedInfo.sizeBytes)
            : `~${model.estimatedSizeMb} MB`;
          const statusLabel = ready
            ? t("manager.status.cached")
            : real
              ? t("manager.status.notDownloaded")
              : t("manager.status.mockOnly");
          const statusClass = ready ? "success" : real ? "accent" : "warn";

          return (
            <div
              key={model.id}
              className="model-row"
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{model.name}</div>
                <div className="muted" style={{ fontSize: "0.76rem" }}>
                  {sizeLabel} · <span className={`badge ${statusClass}`}>{statusLabel}</span>
                </div>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                {real && !ready && (
                  <button
                    className="small primary"
                    onClick={() => onDownload(model)}
                    disabled={disabled || busy}
                  >
                    {t("manager.download")}
                  </button>
                )}
                {ready && (
                  <button
                    className="small danger"
                    onClick={() => onDelete(model)}
                    disabled={disabled || busy}
                  >
                    {t("manager.delete")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row spread" style={{ marginTop: 14 }}>
        <label className="row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={settings.storageSaverEnabled}
            onChange={(e) => onToggleSaver(e.target.checked)}
            disabled={disabled}
            style={{ width: "auto" }}
          />
          <span className="muted">
            {t("manager.saver")}{" "}
            <input
              type="text"
              inputMode="numeric"
              value={settings.storageSaverMaxAgeDays}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n > 0) onSetSaverDays(n);
              }}
              disabled={disabled || !settings.storageSaverEnabled}
              style={{ width: 52, display: "inline-block", padding: "4px 6px", margin: "0 4px" }}
            />{" "}
            {t("manager.saverDays")}
          </span>
        </label>
        <button
          className="small danger"
          onClick={onDeleteAll}
          disabled={disabled || cachedModels.length === 0}
        >
          {t("manager.deleteAll")}
        </button>
      </div>
    </details>
  );
}
