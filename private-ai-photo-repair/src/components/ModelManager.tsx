import type { ModelRegistryEntry, CachedModelInfo, AppSettings } from "../core/models/types";
import { MODEL_REGISTRY } from "../core/models/modelRegistry";
import { formatBytes, formatTimestamp } from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";

interface ModelManagerProps {
  cachedModels: CachedModelInfo[];
  settings: AppSettings;
  onDelete: (modelId: string) => void;
  onRedownload: (model: ModelRegistryEntry) => void;
  onRefresh: () => void;
  onDeleteAll: () => void;
  onToggleSaver: (enabled: boolean) => void;
  onSetSaverDays: (days: number) => void;
  disabled?: boolean;
}

export function ModelManager({
  cachedModels,
  settings,
  onDelete,
  onRedownload,
  onRefresh,
  onDeleteAll,
  onToggleSaver,
  onSetSaverDays,
  disabled,
}: ModelManagerProps): JSX.Element {
  const { t } = useI18n();
  const cachedById = new Map(cachedModels.map((c) => [c.modelId, c]));
  const totalBytes = cachedModels.reduce((sum, c) => sum + c.sizeBytes, 0);

  return (
    <section className="card">
      <div className="row spread">
        <h2>{t("manager.title")}</h2>
        <button className="small ghost" onClick={onRefresh} disabled={disabled}>
          {t("manager.checkCache")}
        </button>
      </div>
      <p className="muted">{t("manager.totalUsed", { size: formatBytes(totalBytes) })}</p>

      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>{t("manager.col.model")}</th>
              <th>{t("manager.col.version")}</th>
              <th>{t("manager.col.size")}</th>
              <th>{t("manager.col.status")}</th>
              <th>{t("manager.col.lastUsed")}</th>
              <th>{t("manager.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_REGISTRY.map((model) => {
              const cached = cachedById.get(model.id);
              const status = cached
                ? t("manager.status.cached")
                : model.transformersModelId
                  ? t("manager.status.real")
                  : model.modelUrl
                    ? t("manager.status.notDownloaded")
                    : t("manager.status.mockOnly");
              return (
                <tr key={model.id}>
                  <td>{model.name}</td>
                  <td>{model.version}</td>
                  <td>
                    {cached ? formatBytes(cached.sizeBytes) : `~${model.estimatedSizeMb} MB`}
                  </td>
                  <td>
                    <span
                      className={`badge ${cached ? "success" : model.transformersModelId ? "accent" : model.modelUrl ? "" : "warn"}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td>{cached ? formatTimestamp(cached.lastUsedAt) : "—"}</td>
                  <td>
                    <div className="row">
                      {cached && (
                        <button
                          className="small danger"
                          onClick={() => onDelete(model.id)}
                          disabled={disabled}
                        >
                          {t("manager.delete")}
                        </button>
                      )}
                      {model.modelUrl && (
                        <button
                          className="small ghost"
                          onClick={() => onRedownload(model)}
                          disabled={disabled}
                        >
                          {cached ? t("manager.redownload") : t("manager.download")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="row spread" style={{ marginTop: 12 }}>
        <label className="row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={settings.storageSaverEnabled}
            onChange={(e) => onToggleSaver(e.target.checked)}
            disabled={disabled}
            style={{ width: "auto" }}
          />
          <span>
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
              style={{ width: 56, display: "inline-block", padding: "4px 6px", margin: "0 4px" }}
            />{" "}
            {t("manager.saverDays")}
          </span>
        </label>
        <button className="small danger" onClick={onDeleteAll} disabled={disabled || cachedModels.length === 0}>
          {t("manager.deleteAll")}
        </button>
      </div>
    </section>
  );
}
