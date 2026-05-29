"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type MaskCanvasHandle = {
  getMaskBlob: () => Promise<Blob | null>;
  clear: () => void;
  hasStrokes: () => boolean;
};

type Point = { x: number; y: number }; // normalized 0..1
type Stroke = { points: Point[]; radius: number }; // radius normalized to width

type Props = {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  brushSize: number; // displayed diameter in px
  onChange?: (hasStrokes: boolean) => void;
};

const MaskCanvas = forwardRef<MaskCanvasHandle, Props>(function MaskCanvas(
  { src, naturalWidth, naturalHeight, brushSize, onChange },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(240, 137, 74, 0.42)";
    ctx.strokeStyle = "rgba(240, 137, 74, 0.42)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      const r = stroke.radius * width;
      ctx.lineWidth = r * 2;
      ctx.beginPath();
      stroke.points.forEach((p, i) => {
        const x = p.x * width;
        const y = p.y * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // round caps for single-point taps
      for (const p of stroke.points) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  // Keep canvas backing store in sync with displayed size (devicePixelRatio aware).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const sync = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      setSize({ w: rect.width, h: rect.height });
      redraw();
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw, naturalWidth, naturalHeight]);

  const radiusNorm = size.w > 0 ? brushSize / 2 / size.w : 0.04;

  const pointFromEvent = useCallback((e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current.push({
      points: [pointFromEvent(e)],
      radius: radiusNorm,
    });
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    stroke.points.push(pointFromEvent(e));
    redraw();
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange?.(strokesRef.current.length > 0);
  };

  useImperativeHandle(ref, () => ({
    hasStrokes: () => strokesRef.current.length > 0,
    clear: () => {
      strokesRef.current = [];
      redraw();
      onChange?.(false);
    },
    getMaskBlob: async () => {
      if (strokesRef.current.length === 0) return null;
      const off = document.createElement("canvas");
      off.width = naturalWidth;
      off.height = naturalHeight;
      const ctx = off.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, naturalWidth, naturalHeight);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#fff";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of strokesRef.current) {
        const r = stroke.radius * naturalWidth;
        ctx.lineWidth = r * 2;
        ctx.beginPath();
        stroke.points.forEach((p, i) => {
          const x = p.x * naturalWidth;
          const y = p.y * naturalHeight;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        for (const p of stroke.points) {
          ctx.beginPath();
          ctx.arc(p.x * naturalWidth, p.y * naturalHeight, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return await new Promise<Blob | null>((resolve) =>
        off.toBlob((b) => resolve(b), "image/png"),
      );
    },
  }));

  const aspect = naturalWidth > 0 ? naturalWidth / naturalHeight : 1;

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full overflow-hidden rounded-2xl"
      style={{ aspectRatio: String(aspect), maxHeight: "62vh" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
      />
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
      />
    </div>
  );
});

export default MaskCanvas;
