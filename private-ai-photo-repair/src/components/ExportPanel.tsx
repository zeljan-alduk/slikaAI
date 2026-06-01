import { useEffect, useState } from "react";
import type { InferenceResult } from "../core/inference/types";
import {
  availableExportFormats,
  defaultFormatForTask,
  type ExportFormat,
} from "../core/image/imageExport";
import { useI18n } from "../i18n/i18n";

interface ExportPanelProps {
  result: InferenceResult | null;
  onExport: (format: ExportFormat) => void;
}

export function ExportPanel({ result, onExport }: ExportPanelProps): JSX.Element | null {
  const { t } = useI18n();
  const [format, setFormat] = useState<ExportFormat>("image/png");

  useEffect(() => {
    if (result) setFormat(defaultFormatForTask(result.taskType));
  }, [result]);

  if (!result) return null;
  const formats = availableExportFormats();

  return (
    <section className="card">
      <h2>{t("export.title")}</h2>
      {result.taskType === "background-removal" && format !== "image/png" && (
        <p className="muted" style={{ color: "var(--warn)" }}>
          {t("export.pngRecommended")}
        </p>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          style={{ maxWidth: 280 }}
        >
          {formats.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => onExport(format)}>
          {t("export.download")}
        </button>
      </div>
    </section>
  );
}
