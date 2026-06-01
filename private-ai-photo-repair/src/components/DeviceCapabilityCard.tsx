import type { DeviceCapabilities, DeviceTier, InferenceBackend } from "../core/capabilities/types";
import { backendLabel, tierLabel } from "../core/capabilities/deviceTier";
import { formatBytes } from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";

interface DeviceCapabilityCardProps {
  capabilities: DeviceCapabilities | null;
  tier: DeviceTier | null;
  backend: InferenceBackend | null;
  maxWorkingSize: number;
}

export function DeviceCapabilityCard({
  capabilities,
  tier,
  backend,
  maxWorkingSize,
}: DeviceCapabilityCardProps): JSX.Element {
  const { t } = useI18n();
  const yesNo = (v: boolean): string => (v ? t("common.yes") : t("common.no"));

  if (!capabilities || !tier || !backend) {
    return (
      <section className="card">
        <h2>{t("device.title")}</h2>
        <p className="muted">{t("device.detecting")}</p>
      </section>
    );
  }

  const supported = tier !== "unsupported";
  const storage =
    capabilities.storageQuotaBytes !== null
      ? t("device.storageValue", {
          free: formatBytes(
            (capabilities.storageQuotaBytes ?? 0) - (capabilities.storageUsageBytes ?? 0),
          ),
          total: formatBytes(capabilities.storageQuotaBytes),
        })
      : t("common.unknown");

  return (
    <details className="card collapsible">
      <summary>
        <span className="summary-title">{t("device.title")}</span>
        <span className={`badge ${supported ? "success" : "warn"}`}>
          {tierLabel(tier)} · {backendLabel(backend)}
        </span>
      </summary>

      <div className="kv-grid">
        <div className="kv">
          <span className="k">{t("device.tier")}</span>
          <span className="v">{tierLabel(tier)}</span>
        </div>
        <div className="kv">
          <span className="k">{t("device.backend")}</span>
          <span className="v">{backendLabel(backend)}</span>
        </div>
        <div className="kv">
          <span className="k">{t("device.maxInput")}</span>
          <span className="v">{t("device.maxInputValue", { n: maxWorkingSize })}</span>
        </div>
        <div className="kv">
          <span className="k">{t("device.storage")}</span>
          <span className="v">{storage}</span>
        </div>
        <div className="kv">
          <span className="k">{t("device.cores")}</span>
          <span className="v">{capabilities.hardwareConcurrency ?? t("common.unknown")}</span>
        </div>
        <div className="kv">
          <span className="k">{t("device.memory")}</span>
          <span className="v">
            {capabilities.deviceMemoryGb ? `${capabilities.deviceMemoryGb} GB` : t("common.unknown")}
          </span>
        </div>
        <div className="kv">
          <span className="k">{t("device.webgpu")}</span>
          <span className="v">{yesNo(capabilities.webgpuSupported)}</span>
        </div>
        <div className="kv">
          <span className="k">{t("device.webglWasm")}</span>
          <span className="v">
            {yesNo(capabilities.webglSupported)} / {yesNo(capabilities.wasmSupported)}
          </span>
        </div>
        <div className="kv">
          <span className="k">{t("device.browser")}</span>
          <span className="v">{capabilities.browserLabel}</span>
        </div>
        <div className="kv">
          <span className="k">{t("device.secure")}</span>
          <span className="v">{yesNo(capabilities.secureContext)}</span>
        </div>
      </div>

      {!capabilities.webgpuSupported && supported && (
        <p className="muted" style={{ marginTop: 10, color: "var(--warn)" }}>
          {t("device.webgpuWarn")}
        </p>
      )}
      {!supported && (
        <p className="muted" style={{ marginTop: 10, color: "var(--warn)" }}>
          {t("device.unsupportedWarn")}
        </p>
      )}
    </details>
  );
}
