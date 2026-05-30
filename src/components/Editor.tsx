"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Dropzone from "./Dropzone";
import MaskCanvas, { type MaskCanvasHandle } from "./MaskCanvas";
import CompareSlider from "./CompareSlider";
import ProgressOverlay from "./ProgressOverlay";
import {
  ArrowRightIcon,
  BrushIcon,
  CloseIcon,
  DownloadIcon,
  ImageIcon,
  RefreshIcon,
  WandIcon,
} from "./Icons";

type Mode = "whole" | "brush";
type Quality = "fast" | "standard" | "high";
type Dims = { w: number; h: number };

// Map API error keys to translated strings.
function useError() {
  const tErr = useTranslations("errors");
  const tPrompt = useTranslations("prompt");
  return (key: string) => {
    switch (key) {
      case "noKey":
        return tErr("noKey");
      case "tooBig":
        return tErr("tooBig");
      case "needImage":
        return tPrompt("needImage");
      case "needPrompt":
        return tPrompt("needPrompt");
      case "needMask":
        return tPrompt("needMask");
      default:
        return tErr("generic");
    }
  };
}

function loadDims(src: string): Promise<Dims> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

// Draw an image (by URL) onto a canvas at the target size and return a PNG blob.
function scaleImageToBlob(src: string, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      );
    };
    img.onerror = reject;
    img.src = src;
  });
}

export default function Editor() {
  const t = useTranslations("prompt");
  const tMode = useTranslations("modes");
  const tBrush = useTranslations("brush");
  const tResult = useTranslations("result");
  const tSug = useTranslations("suggestions");
  const tQ = useTranslations("quality");
  const tTools = useTranslations("tools");
  const locale = useLocale();
  const resolveError = useError();

  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<Dims | null>(null);
  const [mode, setMode] = useState<Mode>("whole");
  const [quality, setQuality] = useState<Quality>("standard");
  const [prompt, setPrompt] = useState("");
  const [brushSize, setBrushSize] = useState(54);
  const [hasMask, setHasMask] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [browserStatus, setBrowserStatus] = useState<string | null>(null);

  const maskRef = useRef<MaskCanvasHandle>(null);
  const objectUrlRef = useRef<string | null>(null);

  const setImageFromFile = useCallback(async (f: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(f);
    objectUrlRef.current = url;
    setFile(f);
    setSrc(url);
    setResult(null);
    setError(null);
    setHasMask(false);
    try {
      setDims(await loadDims(url));
    } catch {
      setDims({ w: 1, h: 1 });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const suggestions = tSug.raw("items") as string[];
  const aspect = dims ? dims.w / dims.h : 1;

  async function submit() {
    if (!file) return setError(resolveError("needImage"));
    if (!prompt.trim()) return setError(resolveError("needPrompt"));

    const form = new FormData();
    form.append("prompt", prompt.trim());
    form.append("mode", mode);
    form.append("quality", quality);
    form.append("locale", locale);

    if (mode === "brush") {
      // Inpainting needs the image and mask at identical, MPS-friendly sizes.
      // Scale both to a cap that grows with the chosen quality.
      const cap = quality === "fast" ? 768 : quality === "high" ? 1280 : 1024;
      const longest = Math.max(dims!.w, dims!.h);
      const s = Math.min(1, cap / longest);
      const tw = Math.round(dims!.w * s);
      const th = Math.round(dims!.h * s);
      const imageBlob = await scaleImageToBlob(src!, tw, th);
      const maskBlob = await maskRef.current?.getMaskBlob(tw, th);
      if (!maskBlob) return setError(resolveError("needMask"));
      form.append("image", imageBlob, "image.png");
      form.append("mask", maskBlob, "mask.png");
    } else {
      // Whole-image: send the original; the workflow scales it server-side.
      form.append("image", file);
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/edit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(resolveError(data?.error ?? "generic"));
      } else {
        setResult(data.imageUrl);
      }
    } catch {
      setError(resolveError("generic"));
    } finally {
      setLoading(false);
    }
  }

  // Fully in-browser background removal (no server, no ComfyUI).
  async function runRemoveBackground() {
    if (!src) return;
    setError(null);
    setBrowserStatus(tTools("loadingModel"));
    try {
      const { removeBackground } = await import("@/lib/browser/removeBackground");
      const dataUrl = await removeBackground(src, (msg, pct) => {
        if (msg === "download") {
          setBrowserStatus(`${tTools("downloading")} ${pct ?? 0}%`);
        } else if (msg === "processing") {
          setBrowserStatus(tTools("processing"));
        } else {
          setBrowserStatus(tTools("loadingModel"));
        }
      });
      setResult(dataUrl);
    } catch {
      setError(tTools("failed"));
    } finally {
      setBrowserStatus(null);
    }
  }

  // Fully in-browser 2x upscaling.
  async function runUpscale() {
    if (!src) return;
    setError(null);
    setBrowserStatus(tTools("loadingModel"));
    try {
      const { upscale } = await import("@/lib/browser/upscale");
      const dataUrl = await upscale(src, (msg, pct) => {
        if (msg === "download") {
          setBrowserStatus(`${tTools("downloading")} ${pct ?? 0}%`);
        } else if (msg === "processing") {
          setBrowserStatus(tTools("upscaling"));
        } else {
          setBrowserStatus(tTools("loadingModel"));
        }
      });
      setResult(dataUrl);
    } catch (e) {
      console.error("[upscale] failed:", e);
      setError(tTools("failed"));
    } finally {
      setBrowserStatus(null);
    }
  }

  // Fully in-browser object removal (LaMa) using the brushed mask.
  async function runRemoveObject() {
    if (!src || !dims) return;
    if (!maskRef.current?.hasStrokes()) return setError(resolveError("needMask"));
    setError(null);
    setBrowserStatus(tTools("loadingModel"));
    try {
      const { removeObject } = await import("@/lib/browser/removeObject");
      const round8 = (n: number) => Math.max(8, Math.round(n / 8) * 8);
      const cap = 512;
      const s = Math.min(1, cap / Math.max(dims.w, dims.h));
      const tw = round8(dims.w * s);
      const th = round8(dims.h * s);
      const imgBlob = await scaleImageToBlob(src, tw, th);
      const maskBlob = await maskRef.current.getMaskBlob(tw, th);
      if (!maskBlob) return setError(resolveError("needMask"));
      const imgUrl = URL.createObjectURL(imgBlob);
      const maskUrl = URL.createObjectURL(maskBlob);
      try {
        const out = await removeObject(imgUrl, maskUrl, tw, th, (msg, pct) => {
          if (msg === "download") {
            setBrowserStatus(`${tTools("downloading")} ${pct ?? 0}%`);
          } else if (msg === "processing") {
            setBrowserStatus(tTools("erasing"));
          } else {
            setBrowserStatus(tTools("loadingModel"));
          }
        });
        setResult(out);
      } finally {
        URL.revokeObjectURL(imgUrl);
        URL.revokeObjectURL(maskUrl);
      }
    } catch (e) {
      console.error("[removeObject] failed:", e);
      setError(tTools("failed"));
    } finally {
      setBrowserStatus(null);
    }
  }

  async function continueEditing() {
    if (!result) return;
    try {
      const res = await fetch(result);
      const blob = await res.blob();
      const f = new File([blob], "slika-edit.png", {
        type: blob.type || "image/png",
      });
      maskRef.current?.clear();
      await setImageFromFile(f);
      setMode("whole");
      setPrompt("");
    } catch {
      setError(resolveError("generic"));
    }
  }

  async function download() {
    if (!result) return;
    try {
      const res = await fetch(result);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "slika-ai.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(result, "_blank");
    }
  }

  function startOver() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setFile(null);
    setSrc(null);
    setDims(null);
    setResult(null);
    setPrompt("");
    setError(null);
    setMode("whole");
    setHasMask(false);
  }

  // ---- Empty state ----
  if (!src || !dims) {
    return <Dropzone onFile={setImageFromFile} />;
  }

  // ---- Result state ----
  if (result) {
    return (
      <div className="rise space-y-5">
        <CompareSlider
          before={src}
          after={result}
          beforeLabel={tResult("before")}
          afterLabel={tResult("after")}
          hint={tResult("dragHint")}
          aspect={aspect}
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={download}
            className="inline-flex items-center gap-2 rounded-full bg-safelight px-5 py-2.5 text-sm font-semibold text-[#1a0f08] transition hover:bg-[#ff9a5c]"
          >
            <DownloadIcon width={18} height={18} />
            {tResult("download")}
          </button>
          <button
            onClick={continueEditing}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-paper transition hover:border-safelight/60"
          >
            <WandIcon width={18} height={18} />
            {tResult("useAsBase")}
          </button>
          <button
            onClick={startOver}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-muted transition hover:text-paper"
          >
            <RefreshIcon width={18} height={18} />
            {tResult("startOver")}
          </button>
        </div>
      </div>
    );
  }

  // ---- Editing state ----
  return (
    <div className="rise space-y-5">
      {/* Stage */}
      <div className="relative">
        {mode === "brush" ? (
          <MaskCanvas
            ref={maskRef}
            src={src}
            naturalWidth={dims.w}
            naturalHeight={dims.h}
            brushSize={brushSize}
            onChange={setHasMask}
          />
        ) : (
          <div
            className="relative mx-auto w-full overflow-hidden rounded-2xl"
            style={{ aspectRatio: String(aspect), maxHeight: "62vh" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
        )}

        {loading && <ProgressOverlay />}

        {browserStatus && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-ink/80 px-6 backdrop-blur-sm">
            <span className="dot-pulse font-display text-2xl text-safelight">●</span>
            <div className="developing h-1.5 w-40 rounded-full" />
            <p className="font-display text-lg text-paper">{browserStatus}</p>
            <p className="text-xs text-muted">{tTools("runsInBrowser")}</p>
          </div>
        )}

        <button
          onClick={startOver}
          aria-label="remove"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-ink/70 text-paper-dim backdrop-blur transition hover:text-paper"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {(
          [
            { id: "whole", icon: ImageIcon, label: tMode("whole"), hint: tMode("wholeHint") },
            { id: "brush", icon: BrushIcon, label: tMode("brush"), hint: tMode("brushHint") },
          ] as const
        ).map(({ id, icon: Icon, label, hint }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={[
                "flex flex-1 items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                active
                  ? "border-safelight/70 bg-safelight/[0.07]"
                  : "border-line bg-surface/50 hover:border-line-soft",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                  active
                    ? "border-safelight/60 bg-safelight/10 text-safelight"
                    : "border-line text-paper-dim",
                ].join(" ")}
              >
                <Icon width={18} height={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-paper">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Quality selector */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/50 px-4 py-3">
        <span className="text-xs uppercase tracking-wider text-muted">
          {tQ("label")}
        </span>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {(
            [
              { id: "fast", label: tQ("fast"), note: tQ("fastNote") },
              { id: "standard", label: tQ("standard"), note: tQ("standardNote") },
              { id: "high", label: tQ("high"), note: tQ("highNote") },
            ] as const
          ).map(({ id, label, note }) => {
            const active = quality === id;
            return (
              <button
                key={id}
                onClick={() => setQuality(id)}
                title={note}
                className={[
                  "flex flex-col rounded-xl border px-3 py-1.5 text-left transition",
                  active
                    ? "border-safelight/70 bg-safelight/[0.08]"
                    : "border-line bg-ink/40 hover:border-line-soft",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-sm font-semibold",
                    active ? "text-safelight" : "text-paper",
                  ].join(" ")}
                >
                  {label}
                </span>
                <span className="text-[11px] text-muted">{note}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brush controls */}
      {mode === "brush" && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface/50 px-4 py-3">
          <span className="text-xs uppercase tracking-wider text-muted">
            {tBrush("size")}
          </span>
          <input
            type="range"
            min={12}
            max={140}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer accent-[#f0894a]"
          />
          <span
            className="rounded-full bg-safelight/20"
            style={{
              width: Math.max(8, brushSize / 4),
              height: Math.max(8, brushSize / 4),
            }}
          />
          <button
            onClick={() => {
              maskRef.current?.clear();
              setHasMask(false);
            }}
            disabled={!hasMask}
            className="text-xs font-medium text-muted transition enabled:hover:text-ember disabled:opacity-40"
          >
            {tBrush("clear")}
          </button>
        </div>
      )}

      {mode === "brush" && (
        <p className="text-center text-xs text-muted">{tBrush("instruction")}</p>
      )}

      {/* Prompt bar */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-xl2)] border border-line bg-surface/70 p-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block px-1 text-xs uppercase tracking-wider text-muted">
            {t("label")}
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            rows={2}
            placeholder={
              mode === "brush"
                ? t("placeholderBrush")
                : t("placeholderWhole")
            }
            className="w-full resize-none rounded-xl border border-line-soft bg-ink/60 px-3.5 py-2.5 text-paper placeholder:text-muted/70 focus:border-safelight/60 focus:outline-none"
          />
        </label>
        <button
          onClick={submit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-safelight px-6 py-3 font-semibold text-[#1a0f08] transition hover:bg-[#ff9a5c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t("submitting") : t("submit")}
          {!loading && <ArrowRightIcon width={18} height={18} />}
        </button>
      </div>

      {error && <p className="text-center text-sm text-ember">{error}</p>}

      {/* Suggestions */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <span className="text-xs text-muted">{tSug("label")}</span>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => setPrompt(s)}
            className="rounded-full border border-line bg-surface/40 px-3 py-1 text-xs text-paper-dim transition hover:border-safelight/50 hover:text-paper"
          >
            {s}
          </button>
        ))}
      </div>

      {/* In-browser instant tools (no server / no prompt) */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/30 px-4 py-3">
        <div className="mr-auto">
          <p className="text-sm font-semibold text-paper">{tTools("title")}</p>
          <p className="text-xs text-muted">{tTools("note")}</p>
        </div>
        <button
          onClick={runRemoveBackground}
          disabled={!!browserStatus || loading}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/50 px-4 py-2 text-sm font-medium text-paper transition enabled:hover:border-safelight/60 disabled:opacity-50"
        >
          {tTools("removeBg")}
        </button>
        <button
          onClick={runRemoveObject}
          disabled={!!browserStatus || loading || mode !== "brush" || !hasMask}
          title={mode !== "brush" ? tTools("needBrush") : undefined}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/50 px-4 py-2 text-sm font-medium text-paper transition enabled:hover:border-safelight/60 disabled:opacity-50"
        >
          {tTools("removeObject")}
        </button>
        <button
          onClick={runUpscale}
          disabled={!!browserStatus || loading}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/50 px-4 py-2 text-sm font-medium text-paper transition enabled:hover:border-safelight/60 disabled:opacity-50"
        >
          {tTools("upscale")}
        </button>
      </div>
    </div>
  );
}
