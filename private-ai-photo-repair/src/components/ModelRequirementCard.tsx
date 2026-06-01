import type { ModelRegistryEntry } from "../core/models/types";
import type { PipelinePlan } from "../core/inference/pipelineFactory";
import { formatBytes } from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";

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
  const { t } = useI18n();
  if (!model || !plan) return null;

  const sizeBytes = model.estimatedSizeMb * 1024 * 1024;

  // Mock mode.
  if (plan.useMock) {
    return (
      <section className="card">
        <div className="row spread">
          <h2>{t("model.title")}</h2>
          <span className="badge warn">{t("model.mockBadge")}</span>
        </div>
        <p className="muted">{t("model.mockBody")}</p>
      </section>
    );
  }

  // Real model via Transformers.js — downloads on first use, cached by browser.
  if (plan.engine === "transformers") {
    return (
      <section className="card">
        <div className="row spread">
          <h2>{t("model.title")}</h2>
          <span className="badge accent">{t("model.realFirstUse")}</span>
        </div>
        <p className="muted">
          {t("model.realFirstUseBody", { id: model.transformersModelId ?? model.name })}
        </p>
      </section>
    );
  }

  // Raw ONNX model already cached.
  if (cached) {
    return (
      <section className="card">
        <div className="row spread">
          <h2>{t("model.title")}</h2>
          <span className="badge success">{t("model.readyOnDevice")}</span>
        </div>
        <p className="muted">{t("model.readyBody", { name: model.name, version: model.version })}</p>
      </section>
    );
  }

  // Raw ONNX model needs downloading.
  const insufficientStorage =
    freeStorageBytes !== null && freeStorageBytes < sizeBytes;
  const afterInstall =
    freeStorageBytes !== null ? Math.max(0, freeStorageBytes - sizeBytes) : null;

  return (
    <section className="card">
      <h2>{t("model.required")}</h2>
      <p className="muted">{t("model.requiredBody")}</p>
      <ul className="privacy" style={{ marginTop: 4, paddingLeft: 18 }}>
        <li>{t("model.b1")}</li>
        <li>{t("model.b2")}</li>
        <li>{t("model.b3")}</li>
        <li>{t("model.b4")}</li>
        <li>{t("model.b5")}</li>
      </ul>

      <div className="kv-grid" style={{ marginTop: 12 }}>
        <div className="kv">
          <span className="k">{t("model.name")}</span>
          <span className="v">{model.name}</span>
        </div>
        <div className="kv">
          <span className="k">{t("model.version")}</span>
          <span className="v">{model.version}</span>
        </div>
        <div className="kv">
          <span className="k">{t("model.size")}</span>
          <span className="v">{formatBytes(sizeBytes)}</span>
        </div>
        <div className="kv">
          <span className="k">{t("model.storageAvail")}</span>
          <span className="v">
            {freeStorageBytes !== null ? formatBytes(freeStorageBytes) : t("common.unknown")}
          </span>
        </div>
        <div className="kv">
          <span className="k">{t("model.afterInstall")}</span>
          <span className="v">
            {afterInstall !== null ? formatBytes(afterInstall) : t("common.unknown")}
          </span>
        </div>
      </div>

      {insufficientStorage && (
        <p className="muted" style={{ color: "var(--warn)", marginTop: 10 }}>
          {t("model.insufficient")}
        </p>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={onDownload}
          disabled={disabled || insufficientStorage}
        >
          {t("model.download")}
        </button>
      </div>
    </section>
  );
}
