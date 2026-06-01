import { useCallback, useEffect, useRef, useState } from "react";
import type { InferenceResult } from "../core/inference/types";
import type { UserImageAsset } from "../core/image/types";
import { backendLabel } from "../core/capabilities/deviceTier";
import { formatDuration } from "../core/progress/formatters";

interface BeforeAfterPreviewProps {
  beforeAsset: UserImageAsset | null;
  result: InferenceResult | null;
}

export function BeforeAfterPreview({ beforeAsset, result }: BeforeAfterPreviewProps): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = (): void => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [result]);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  }, []);

  if (!beforeAsset || !result) return null;

  return (
    <section className="card">
      <h2>Before / after</h2>
      <div
        className="compare"
        ref={containerRef}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) updateFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <img src={beforeAsset.objectUrl} alt="Before" draggable={false} />
        <div className="after-wrap" style={{ width: `${position}%` }}>
          <img
            src={result.outputObjectUrl}
            alt="After"
            draggable={false}
            style={{ width: containerWidth ? `${containerWidth}px` : "100%" }}
          />
        </div>
        <div className="handle" style={{ left: `${position}%` }} />
      </div>
      <div className="row" style={{ marginTop: 6, justifyContent: "space-between" }}>
        <span className="muted">◀ Before</span>
        <span className="muted">After ▶</span>
      </div>

      {result.usedMock && (
        <p className="muted" style={{ color: "var(--warn)", marginTop: 8 }}>
          ⚠ This result was generated in mock mode. Connect a real ONNX model for
          production-quality AI restoration.
        </p>
      )}

      <div className="kv-grid" style={{ marginTop: 10 }}>
        <div className="kv">
          <span className="k">Original</span>
          <span className="v">{beforeAsset.width} × {beforeAsset.height}</span>
        </div>
        <div className="kv">
          <span className="k">Processed</span>
          <span className="v">{result.width} × {result.height}</span>
        </div>
        <div className="kv">
          <span className="k">Output format</span>
          <span className="v">{result.mimeType}</span>
        </div>
        <div className="kv">
          <span className="k">Backend</span>
          <span className="v">{backendLabel(result.usedBackend)}</span>
        </div>
        <div className="kv">
          <span className="k">Duration</span>
          <span className="v">{formatDuration(result.processingDurationMs / 1000)}</span>
        </div>
      </div>
    </section>
  );
}
