"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Prog = {
  available: boolean;
  value: number;
  max: number;
  percent: number;
  running: boolean;
  ts: number;
};

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ProgressOverlay() {
  const t = useTranslations("prompt");
  const startRef = useRef<number>(Date.now());
  const lastRef = useRef<{ v: number; ts: number; stepMs: number }>({
    v: 0,
    ts: Date.now(),
    stepMs: 0,
  });
  const [elapsed, setElapsed] = useState(0);
  const [prog, setProg] = useState<Prog | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    lastRef.current = { v: 0, ts: Date.now(), stepMs: 0 };
    let alive = true;

    const ticker = setInterval(
      () => setElapsed((Date.now() - startRef.current) / 1000),
      250,
    );

    const poll = async () => {
      try {
        const r = await fetch("/api/progress", { cache: "no-store" });
        const d = await r.json();
        if (!alive) return;
        if (!d.available) {
          setProg({ available: false, value: 0, max: 0, percent: 0, running: false, ts: 0 });
          return;
        }
        // Ignore progress left over from a previous job (stale timestamp).
        const fresh = d.ts >= startRef.current - 1500;
        const value = fresh ? d.value : 0;
        const max = fresh ? d.max : 0;
        if (value > lastRef.current.v && value > 0) {
          const now = Date.now();
          lastRef.current = {
            v: value,
            ts: now,
            stepMs: (now - lastRef.current.ts) / (value - lastRef.current.v),
          };
        }
        setProg({
          available: true,
          value,
          max,
          percent: max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0,
          running: d.running,
          ts: d.ts,
        });
      } catch {
        /* keep last state */
      }
    };

    poll();
    const poller = setInterval(poll, 1000);
    return () => {
      alive = false;
      clearInterval(ticker);
      clearInterval(poller);
    };
  }, []);

  const available = prog?.available ?? false;
  const value = prog?.value ?? 0;
  const max = prog?.max ?? 0;
  const percent = prog?.percent ?? 0;
  const sampling = available && max > 0;
  const showPct = sampling;

  let stage: string;
  let eta = NaN;
  if (!available) {
    stage = t("submitting");
  } else if (max === 0) {
    stage = elapsed < 6 ? t("preparing") : t("loadingModel");
  } else if (value < max) {
    stage = t("painting");
    eta = ((max - value) * (lastRef.current.stepMs || 16000)) / 1000;
  } else {
    stage = t("finishing");
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-ink/80 px-6 backdrop-blur-sm">
      {showPct ? (
        <span className="font-display text-5xl tabular-nums text-paper">{percent}%</span>
      ) : (
        <span className="dot-pulse font-display text-2xl text-safelight">●</span>
      )}

      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
        {showPct ? (
          <div
            className="h-full rounded-full bg-safelight transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        ) : (
          <div className="developing h-full w-1/2 rounded-full" />
        )}
      </div>

      <div className="text-center">
        <p className="font-display text-lg text-paper">
          {stage}
          {sampling && value < max ? "…" : ""}
        </p>
        <p className="mt-1 text-xs tabular-nums text-muted">
          {sampling && (
            <span>{t("stepOf", { current: Math.min(value, max), total: max })} · </span>
          )}
          {t("elapsed")} {fmt(elapsed)}
          {sampling && value < max && isFinite(eta) ? (
            <span>
              {" "}
              · ~{fmt(eta)} {t("left")}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
