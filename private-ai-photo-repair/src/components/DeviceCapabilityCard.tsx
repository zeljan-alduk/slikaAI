import type { DeviceCapabilities, DeviceTier, InferenceBackend } from "../core/capabilities/types";
import { backendLabel, tierLabel } from "../core/capabilities/deviceTier";
import { formatBytes } from "../core/progress/formatters";

interface DeviceCapabilityCardProps {
  capabilities: DeviceCapabilities | null;
  tier: DeviceTier | null;
  backend: InferenceBackend | null;
  maxWorkingSize: number;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function DeviceCapabilityCard({
  capabilities,
  tier,
  backend,
  maxWorkingSize,
}: DeviceCapabilityCardProps): JSX.Element {
  if (!capabilities || !tier || !backend) {
    return (
      <section className="card">
        <h2>Device capabilities</h2>
        <p className="muted">Detecting device capabilities…</p>
      </section>
    );
  }

  const supported = tier !== "unsupported";
  const storage =
    capabilities.storageQuotaBytes !== null
      ? `${formatBytes(
          (capabilities.storageQuotaBytes ?? 0) - (capabilities.storageUsageBytes ?? 0),
        )} free of ${formatBytes(capabilities.storageQuotaBytes)}`
      : "Unknown";

  return (
    <section className="card">
      <div className="row spread">
        <h2>Device capabilities</h2>
        <span className={`badge ${supported ? "success" : "warn"}`}>
          {supported ? "Local AI supported" : "Local AI not supported"}
        </span>
      </div>

      <div className="kv-grid" style={{ marginTop: 10 }}>
        <div className="kv">
          <span className="k">Device tier</span>
          <span className="v">{tierLabel(tier)}</span>
        </div>
        <div className="kv">
          <span className="k">Selected backend</span>
          <span className="v">{backendLabel(backend)}</span>
        </div>
        <div className="kv">
          <span className="k">Max input size</span>
          <span className="v">{maxWorkingSize}px longest side</span>
        </div>
        <div className="kv">
          <span className="k">Storage available</span>
          <span className="v">{storage}</span>
        </div>
        <div className="kv">
          <span className="k">CPU cores</span>
          <span className="v">{capabilities.hardwareConcurrency ?? "Unknown"}</span>
        </div>
        <div className="kv">
          <span className="k">Device memory</span>
          <span className="v">
            {capabilities.deviceMemoryGb ? `${capabilities.deviceMemoryGb} GB` : "Unknown"}
          </span>
        </div>
        <div className="kv">
          <span className="k">WebGPU</span>
          <span className="v">{yesNo(capabilities.webgpuSupported)}</span>
        </div>
        <div className="kv">
          <span className="k">WebGL / WASM</span>
          <span className="v">
            {yesNo(capabilities.webglSupported)} / {yesNo(capabilities.wasmSupported)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Browser</span>
          <span className="v">{capabilities.browserLabel}</span>
        </div>
        <div className="kv">
          <span className="k">Secure context</span>
          <span className="v">{yesNo(capabilities.secureContext)}</span>
        </div>
      </div>

      {!capabilities.webgpuSupported && supported && (
        <p className="muted" style={{ marginTop: 10, color: "var(--warn)" }}>
          ⚠ WebGPU is not available on this device/browser. The app will use a
          slower fallback.
        </p>
      )}
      {!supported && (
        <p className="muted" style={{ marginTop: 10, color: "var(--warn)" }}>
          ⚠ Your browser does not support the required local APIs (Web Workers,
          WASM, and IndexedDB/Cache Storage) for running AI models.
        </p>
      )}
    </section>
  );
}
