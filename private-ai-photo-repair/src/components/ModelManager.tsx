import type { ModelRegistryEntry, CachedModelInfo, AppSettings } from "../core/models/types";
import { MODEL_REGISTRY } from "../core/models/modelRegistry";
import { formatBytes, formatTimestamp } from "../core/progress/formatters";

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
  const cachedById = new Map(cachedModels.map((c) => [c.modelId, c]));
  const totalBytes = cachedModels.reduce((sum, c) => sum + c.sizeBytes, 0);

  return (
    <section className="card">
      <div className="row spread">
        <h2>Model manager</h2>
        <button className="small ghost" onClick={onRefresh} disabled={disabled}>
          Check cache
        </button>
      </div>
      <p className="muted">Total AI storage used: {formatBytes(totalBytes)}</p>

      <div className="table-scroll" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Version</th>
              <th>Size</th>
              <th>Status</th>
              <th>Last used</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_REGISTRY.map((model) => {
              const cached = cachedById.get(model.id);
              const status = cached
                ? "Cached"
                : model.modelUrl
                  ? "Not downloaded"
                  : "Mock only";
              return (
                <tr key={model.id}>
                  <td>{model.name}</td>
                  <td>{model.version}</td>
                  <td>
                    {cached ? formatBytes(cached.sizeBytes) : `~${model.estimatedSizeMb} MB`}
                  </td>
                  <td>
                    <span
                      className={`badge ${cached ? "success" : model.modelUrl ? "" : "warn"}`}
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
                          Delete
                        </button>
                      )}
                      {model.modelUrl && (
                        <button
                          className="small ghost"
                          onClick={() => onRedownload(model)}
                          disabled={disabled}
                        >
                          {cached ? "Re-download" : "Download"}
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
            Storage saver: auto-remove models unused for{" "}
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
            days
          </span>
        </label>
        <button className="small danger" onClick={onDeleteAll} disabled={disabled || cachedModels.length === 0}>
          Delete all models
        </button>
      </div>
    </section>
  );
}
