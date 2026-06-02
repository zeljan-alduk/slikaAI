import type { RetouchIntent } from "../core/prompt/promptTypes";
import { useI18n } from "../i18n/i18n";

interface PromptBoxProps {
  value: string;
  onChange: (value: string) => void;
  intent: RetouchIntent | null;
  disabled?: boolean;
}

const TASK_LABELS: Record<string, string> = {
  "background-removal": "Background removal",
  enhance: "Enhance",
  denoise: "Denoise",
  "super-resolution": "Super resolution",
  "restore-old-photo": "Restore old photo",
  "reference-guided-restore": "Reference-guided restore",
  "smart-crop": "Smart crop",
  unknown: "Unknown",
};

export function PromptBox({ value, onChange, intent, disabled }: PromptBoxProps): JSX.Element {
  const { t } = useI18n();
  return (
    <section className="card">
      <h2>{t("prompt.title")}</h2>
      <p className="muted">{t("prompt.help")}</p>
      <textarea
        value={value}
        disabled={disabled}
        placeholder={t("prompt.placeholder")}
        onChange={(e) => onChange(e.target.value)}
        style={{ marginTop: 8 }}
      />

      {intent && value.trim().length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h3>{t("prompt.understoodAs")}</h3>
          <div className="row">
            <span className="badge accent">{TASK_LABELS[intent.task] ?? intent.task}</span>
            <span className="badge">{t("prompt.strength")}: {intent.strength}</span>
            <span className="badge">{t("prompt.language")}: {intent.language}</span>
            {intent.usesReferenceImages && (
              <span className="badge">{t("prompt.reference")}: {intent.referenceMode}</span>
            )}
            <span className="badge">
              {t("prompt.confidence")}: {Math.round(intent.confidence * 100)}%
            </span>
          </div>
          {intent.task === "smart-crop" && (
            <p className="muted" style={{ marginTop: 6 }}>
              {t("prompt.smartCropHint")}
            </p>
          )}
          {intent.warnings.map((w) => (
            <p key={w} className="muted" style={{ color: "var(--warn)", marginTop: 6 }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
