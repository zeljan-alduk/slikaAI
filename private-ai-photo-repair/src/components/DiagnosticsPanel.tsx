import { useState } from "react";
import type { DeviceCapabilities, DeviceTier, InferenceBackend } from "../core/capabilities/types";
import type {
  ModelRegistryEntry,
  CachedModelInfo,
  DownloadProgress,
  ModelLoadProgress,
} from "../core/models/types";
import type {
  ProcessingProgress,
  TileProgress,
  PipelineLogEntry,
} from "../core/progress/progressTypes";
import type { UserImageAsset } from "../core/image/types";
import { TaskLogViewer } from "./TaskLogViewer";
import { buildDiagnostics, diagnosticsToJson, copyToClipboard } from "../core/diagnostics/diagnostics";
import { formatBytes, formatDuration } from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";

interface DiagnosticsPanelProps {
  capabilities: DeviceCapabilities | null;
  tier: DeviceTier | null;
  backend: InferenceBackend | null;
  mainImage: UserImageAsset | null;
  referenceCount: number;
  selectedModel: ModelRegistryEntry | null;
  selectedModelCached: boolean;
  cachedModels: CachedModelInfo[];
  downloadProgress: DownloadProgress | null;
  modelLoadProgress: ModelLoadProgress | null;
  processingProgress: ProcessingProgress | null;
  tileProgress: TileProgress | null;
  logs: PipelineLogEntry[];
}

export function DiagnosticsPanel(props: DiagnosticsPanelProps): JSX.Element {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    const snapshot = buildDiagnostics({
      capabilities: props.capabilities,
      selectedModel: props.selectedModel,
      cachedModels: props.cachedModels,
      downloadProgress: props.downloadProgress,
      modelLoadProgress: props.modelLoadProgress,
      processingProgress: props.processingProgress,
      tileProgress: props.tileProgress,
      logs: props.logs,
    });
    const ok = await copyToClipboard(diagnosticsToJson(snapshot));
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  const pp = props.processingProgress;

  return (
    <section className="card">
      <details>
        <summary>{t("diag.title")}</summary>
        <div style={{ marginTop: 10 }}>
          <div className="row spread">
            <h3>{t("diag.title")}</h3>
            <button className="small ghost" onClick={() => void handleCopy()}>
              {copied ? t("diag.copied") : t("diag.copy")}
            </button>
          </div>

          <div className="kv-grid" style={{ marginTop: 6 }}>
            <div className="kv">
              <span className="k">Device tier</span>
              <span className="v">{props.tier ?? "—"}</span>
            </div>
            <div className="kv">
              <span className="k">Backend</span>
              <span className="v">{props.backend ?? "—"}</span>
            </div>
            <div className="kv">
              <span className="k">Image original</span>
              <span className="v">
                {props.mainImage ? `${props.mainImage.width}×${props.mainImage.height}` : "—"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Image processed</span>
              <span className="v">
                {pp && pp.status === "completed" && props.processingProgress
                  ? "see preview"
                  : "—"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Reference images</span>
              <span className="v">{props.referenceCount}</span>
            </div>
            <div className="kv">
              <span className="k">Selected model</span>
              <span className="v">{props.selectedModel?.name ?? "—"}</span>
            </div>
            <div className="kv">
              <span className="k">Model cached</span>
              <span className="v">{props.selectedModelCached ? "Yes" : "No"}</span>
            </div>
            <div className="kv">
              <span className="k">Model size</span>
              <span className="v">
                {props.selectedModel ? `~${props.selectedModel.estimatedSizeMb} MB` : "—"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Model version</span>
              <span className="v">{props.selectedModel?.version ?? "—"}</span>
            </div>
            <div className="kv">
              <span className="k">Cached total</span>
              <span className="v">
                {formatBytes(props.cachedModels.reduce((s, c) => s + c.sizeBytes, 0))}
              </span>
            </div>
          </div>

          {props.downloadProgress && (
            <p className="muted" style={{ marginTop: 8 }}>
              Download: {props.downloadProgress.status} — {props.downloadProgress.message}
            </p>
          )}
          {props.modelLoadProgress && (
            <p className="muted">
              Model load: {props.modelLoadProgress.status} ({props.modelLoadProgress.percentage ?? "—"}%)
            </p>
          )}
          {props.tileProgress && props.tileProgress.totalTiles > 1 && (
            <p className="muted">
              Tiles: {props.tileProgress.completedTiles}/{props.tileProgress.totalTiles}
            </p>
          )}

          {pp && (
            <div style={{ marginTop: 8 }}>
              <h3>Step durations</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Status</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pp.steps.map((s) => (
                      <tr key={s.id}>
                        <td>{s.label}</td>
                        <td>{s.status}</td>
                        <td>{s.durationMs !== null ? formatDuration(s.durationMs / 1000) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <h3 style={{ marginTop: 10 }}>Logs</h3>
          <TaskLogViewer logs={props.logs} />
        </div>
      </details>
    </section>
  );
}
