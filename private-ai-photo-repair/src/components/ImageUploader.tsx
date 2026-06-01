import { useId, useRef, useState } from "react";
import type { UserImageAsset } from "../core/image/types";
import { formatBytes } from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";
import { UploadCloud } from "./Icons";

interface ImageUploaderProps {
  asset: UserImageAsset | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  maxWorkingSize: number;
}

export function ImageUploader({
  asset,
  onFile,
  onRemove,
  disabled,
  maxWorkingSize,
}: ImageUploaderProps): JSX.Element {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const handleFiles = (files: FileList | null): void => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  const tooLarge = asset ? Math.max(asset.width, asset.height) > maxWorkingSize : false;

  return (
    <section className="card">
      <h2>{t("image.title")}</h2>
      <p className="muted">{t("image.help")}</p>

      {!asset ? (
        <label
          htmlFor={inputId}
          className={`dropzone${dragover ? " dragover" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragover(false);
            if (!disabled) handleFiles(e.dataTransfer.files);
          }}
          style={{ marginTop: 10 }}
        >
          <span className="dz-icon">
            <UploadCloud size={30} />
          </span>
          <div className="dz-title">{t("image.drop")}</div>
          <div className="dz-sub">{t("image.stays")}</div>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div className="thumb">
            <img src={asset.objectUrl} alt="Selected" />
          </div>
          <div className="kv-grid" style={{ marginTop: 10 }}>
            <div className="kv">
              <span className="k">{t("image.filename")}</span>
              <span className="v" style={{ wordBreak: "break-all" }}>{asset.file.name}</span>
            </div>
            <div className="kv">
              <span className="k">{t("image.size")}</span>
              <span className="v">{formatBytes(asset.sizeBytes)}</span>
            </div>
            <div className="kv">
              <span className="k">{t("image.dimensions")}</span>
              <span className="v">{asset.width} × {asset.height}</span>
            </div>
            <div className="kv">
              <span className="k">{t("image.type")}</span>
              <span className="v">{asset.mimeType}</span>
            </div>
          </div>
          {tooLarge && (
            <p className="muted" style={{ color: "var(--warn)", marginTop: 8 }}>
              {t("image.tooLarge", { n: maxWorkingSize })}
            </p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="small ghost" onClick={() => inputRef.current?.click()} disabled={disabled}>
              {t("image.replace")}
            </button>
            <button className="small danger" onClick={onRemove} disabled={disabled}>
              {t("image.remove")}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={disabled}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
