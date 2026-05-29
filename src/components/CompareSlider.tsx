"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  hint: string;
  aspect: number;
};

export default function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  hint,
  aspect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, p)));
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full select-none overflow-hidden rounded-2xl border border-line bg-ink"
      style={{ aspectRatio: String(aspect), maxHeight: "62vh" }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      {/* After (full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt={afterLabel}
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
      />
      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt={beforeLabel}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-paper-dim backdrop-blur">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-safelight/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#1a0f08] backdrop-blur">
        {afterLabel}
      </span>

      {/* Handle */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-safelight"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-safelight bg-ink/90 text-safelight shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6 3 12l6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>

      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/60 px-3 py-1 text-[11px] tracking-wide text-paper-dim backdrop-blur">
        {hint}
      </span>
    </div>
  );
}
