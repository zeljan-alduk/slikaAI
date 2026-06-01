import { useId } from "react";
import type { ReferenceImageAsset, ReferenceType } from "../core/image/types";
import { useI18n } from "../i18n/i18n";

interface ReferenceImageUploaderProps {
  references: ReferenceImageAsset[];
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
  onTypeChange: (id: string, type: ReferenceType) => void;
  disabled?: boolean;
}

const REFERENCE_TYPES: ReferenceType[] = [
  "same-person",
  "same-face",
  "same-scene",
  "color-style",
  "unknown",
];

export function ReferenceImageUploader({
  references,
  onAdd,
  onRemove,
  onTypeChange,
  disabled,
}: ReferenceImageUploaderProps): JSX.Element {
  const { t } = useI18n();
  const inputId = useId();

  return (
    <section className="card">
      <h2>{t("ref.title")}</h2>
      <p className="muted">{t("ref.help")}</p>

      {references.length > 0 && (
        <div className="ref-grid" style={{ marginTop: 12 }}>
          {references.map((ref) => (
            <div className="ref-item" key={ref.id}>
              <img src={ref.objectUrl} alt="Reference" />
              <select
                value={ref.referenceType}
                disabled={disabled}
                onChange={(e) => onTypeChange(ref.id, e.target.value as ReferenceType)}
                aria-label={t("ref.typeAria")}
              >
                {REFERENCE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`ref.type.${value}`)}
                  </option>
                ))}
              </select>
              {ref.referenceType !== "same-person" && ref.referenceType !== "same-face" && (
                <span className="muted" style={{ fontSize: "0.72rem" }}>
                  {t("ref.styleOnly")}
                </span>
              )}
              <button className="small danger" onClick={() => onRemove(ref.id)} disabled={disabled}>
                {t("ref.remove")}
              </button>
            </div>
          ))}
        </div>
      )}

      <label htmlFor={inputId} style={{ display: "inline-block", marginTop: 12 }}>
        <span className="badge accent" style={{ cursor: "pointer" }}>
          {t("ref.add")}
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
