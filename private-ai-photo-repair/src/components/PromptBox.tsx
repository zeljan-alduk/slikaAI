import type { RetouchIntent } from "../core/prompt/promptTypes";

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
  unknown: "Unknown",
};

export function PromptBox({ value, onChange, intent, disabled }: PromptBoxProps): JSX.Element {
  return (
    <section className="card">
      <h2>Describe what to do</h2>
      <p className="muted">Write in Croatian or English. For example: “ukloni pozadinu” or “restore old photo”.</p>
      <textarea
        value={value}
        disabled={disabled}
        placeholder="ukloni pozadinu / remove background / popravi staru fotografiju…"
        onChange={(e) => onChange(e.target.value)}
        style={{ marginTop: 8 }}
      />

      {intent && value.trim().length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h3>Understood as</h3>
          <div className="row">
            <span className="badge accent">{TASK_LABELS[intent.task] ?? intent.task}</span>
            <span className="badge">Strength: {intent.strength}</span>
            <span className="badge">Language: {intent.language}</span>
            {intent.usesReferenceImages && (
              <span className="badge">Reference: {intent.referenceMode}</span>
            )}
            <span className="badge">Confidence: {Math.round(intent.confidence * 100)}%</span>
          </div>
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
