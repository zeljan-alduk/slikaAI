import { useId, useRef, useState } from "react";
import type { UserImageAsset } from "../core/image/types";
import { formatBytes } from "../core/progress/formatters";

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
      <h2>Main photo</h2>
      <p className="muted">Upload the photo you want to repair (JPEG, PNG or WebP).</p>

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
          <div style={{ fontSize: "1.6rem" }}>🖼️</div>
          <div>Tap or drop an image here</div>
          <div className="muted">It stays on your device.</div>
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
              <span className="k">Filename</span>
              <span className="v" style={{ wordBreak: "break-all" }}>{asset.file.name}</span>
            </div>
            <div className="kv">
              <span className="k">Size</span>
              <span className="v">{formatBytes(asset.sizeBytes)}</span>
            </div>
            <div className="kv">
              <span className="k">Dimensions</span>
              <span className="v">{asset.width} × {asset.height}</span>
            </div>
            <div className="kv">
              <span className="k">Type</span>
              <span className="v">{asset.mimeType}</span>
            </div>
          </div>
          {tooLarge && (
            <p className="muted" style={{ color: "var(--warn)", marginTop: 8 }}>
              ⚠ This image is large for this device and will be resized to{" "}
              {maxWorkingSize}px (longest side) before processing.
            </p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="small ghost" onClick={() => inputRef.current?.click()} disabled={disabled}>
              Replace
            </button>
            <button className="small danger" onClick={onRemove} disabled={disabled}>
              Remove
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
