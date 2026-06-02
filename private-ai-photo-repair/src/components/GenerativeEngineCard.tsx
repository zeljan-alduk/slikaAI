import type {
  EnginePreference,
  GenerativeEngineDecision,
} from "../core/generative/engineSelector";

interface GenerativeEngineCardProps {
  decision: GenerativeEngineDecision | null;
  preference: EnginePreference;
  onPreferenceChange: (preference: EnginePreference) => void;
  cloudConsent: boolean;
  onCloudConsentChange: (consent: boolean) => void;
  cloudConfigured: boolean;
  disabled?: boolean;
}

const OPTIONS: { value: EnginePreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "local", label: "On-device" },
  { value: "cloud", label: "Cloud" },
];

/**
 * Hybrid engine control for the generative-edit task. Lets the user pick the
 * on-device or cloud engine (or auto), and gates the cloud engine behind an
 * explicit consent checkbox because the image leaves the device.
 */
export function GenerativeEngineCard({
  decision,
  preference,
  onPreferenceChange,
  cloudConsent,
  onCloudConsentChange,
  cloudConfigured,
  disabled,
}: GenerativeEngineCardProps): JSX.Element {
  // Show the consent control when the user is steering toward cloud, or when
  // auto would reach for cloud (endpoint configured but not yet consented).
  const showConsent =
    preference === "cloud" || (preference === "auto" && cloudConfigured);

  const leavesDevice = decision?.privacy === "leaves-device" && decision.engine === "cloud";

  return (
    <section className="card">
      <div className="row spread">
        <h2>Generative engine</h2>
        {decision?.engine && (
          <span className={`badge ${leavesDevice ? "warn" : "success"}`}>
            {leavesDevice ? "Leaves device" : "On-device"}
          </span>
        )}
      </div>

      <p className="muted">
        Generative editing (“describe any edit”) needs a diffusion-class model.
        Run it on-device for full privacy, or via an opt-in cloud endpoint that
        works on any device — your choice.
      </p>

      <div className="chips" style={{ marginTop: 8 }}>
        {OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              className={`small ${active ? "primary" : "ghost"}`}
              aria-pressed={active}
              onClick={() => onPreferenceChange(opt.value)}
              disabled={disabled}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {showConsent && (
        <div style={{ marginTop: 12 }}>
          {!cloudConfigured && (
            <p className="muted" style={{ color: "var(--warn)" }}>
              ⚠ No cloud endpoint is configured (set VITE_CLOUD_EDIT_ENDPOINT).
              Without it, the cloud engine is unavailable.
            </p>
          )}
          <label className="row" style={{ gap: 8, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={cloudConsent}
              onChange={(e) => onCloudConsentChange(e.target.checked)}
              disabled={disabled || !cloudConfigured}
            />
            <span className="muted">
              I understand that, for cloud generative edits, <strong>this image
              will be uploaded to the configured endpoint</strong> and leaves my
              device. It may be processed and cached by that service.
            </span>
          </label>
        </div>
      )}

      {decision && (
        <p
          className="muted"
          style={{
            marginTop: 10,
            color: decision.engine ? undefined : "var(--warn)",
          }}
        >
          {decision.engine
            ? decision.reason
            : decision.blockedReason ?? decision.reason}
          {decision.simulated && decision.engine && (
            <>
              {" "}
              <strong>Result will be a clearly-labelled simulation.</strong>
            </>
          )}
        </p>
      )}
    </section>
  );
}
