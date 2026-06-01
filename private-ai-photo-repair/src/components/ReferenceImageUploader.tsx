import { useId } from "react";
import type { ReferenceImageAsset, ReferenceType } from "../core/image/types";

interface ReferenceImageUploaderProps {
  references: ReferenceImageAsset[];
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
  onTypeChange: (id: string, type: ReferenceType) => void;
  disabled?: boolean;
}

const REFERENCE_TYPE_OPTIONS: { value: ReferenceType; label: string }[] = [
  { value: "same-person", label: "Same person" },
  { value: "same-face", label: "Same face" },
  { value: "same-scene", label: "Same scene" },
  { value: "color-style", label: "Color / style reference" },
  { value: "unknown", label: "Unknown" },
];

export function ReferenceImageUploader({
  references,
  onAdd,
  onRemove,
  onTypeChange,
  disabled,
}: ReferenceImageUploaderProps): JSX.Element {
  const inputId = useId();

  return (
    <section className="card">
      <h2>Optional reference photos</h2>
      <p className="muted">
        Reference photos are used locally to guide restoration. They are not
        uploaded. Use better-quality photos of the same person to guide a repair.
      </p>

      {references.length > 0 && (
        <div className="ref-grid" style={{ marginTop: 12 }}>
          {references.map((ref) => (
            <div className="ref-item" key={ref.id}>
              <img src={ref.objectUrl} alt="Reference" />
              <select
                value={ref.referenceType}
                disabled={disabled}
                onChange={(e) => onTypeChange(ref.id, e.target.value as ReferenceType)}
                aria-label="Reference type"
              >
                {REFERENCE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {ref.referenceType !== "same-person" && ref.referenceType !== "same-face" && (
                <span className="muted" style={{ fontSize: "0.72rem" }}>
                  Affects style/color only unless marked same person.
                </span>
              )}
              <button className="small danger" onClick={() => onRemove(ref.id)} disabled={disabled}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <label htmlFor={inputId} style={{ display: "inline-block", marginTop: 12 }}>
        <span className="badge accent" style={{ cursor: "pointer" }}>
          + Add reference photo
        </span>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAdd(file);
            e.target.value = "";
          }}
        />
      </label>
    </section>
  );
}
