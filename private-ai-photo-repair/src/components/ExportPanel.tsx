import { useEffect, useState } from "react";
import type { InferenceResult } from "../core/inference/types";
import {
  availableExportFormats,
  defaultFormatForTask,
  type ExportFormat,
} from "../core/image/imageExport";

interface ExportPanelProps {
  result: InferenceResult | null;
  onExport: (format: ExportFormat) => void;
}

export function ExportPanel({ result, onExport }: ExportPanelProps): JSX.Element | null {
  const [format, setFormat] = useState<ExportFormat>("image/png");

  useEffect(() => {
    if (result) setFormat(defaultFormatForTask(result.taskType));
  }, [result]);

  if (!result) return null;
  const formats = availableExportFormats();

  return (
    <section className="card">
      <h2>Export result</h2>
      {result.taskType === "background-removal" && format !== "image/png" && (
        <p className="muted" style={{ color: "var(--warn)" }}>
          ⚠ PNG is recommended for background removal to preserve transparency.
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
          Download
        </button>
      </div>
    </section>
  );
}
