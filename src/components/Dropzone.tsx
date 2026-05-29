"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadIcon } from "./Icons";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 20 * 1024 * 1024;

export default function Dropzone({
  onFile,
}: {
  onFile: (file: File) => void;
}) {
  const t = useTranslations("dropzone");
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handle(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setError(t("wrongType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t("tooLarge"));
      return;
    }
    setError(null);
    onFile(file);
  }

  return (
    <div className="rise">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={[
          "group relative flex w-full flex-col items-center justify-center gap-5 rounded-[var(--radius-xl2)] border px-8 py-20 text-center transition-all duration-300",
          over
            ? "border-safelight bg-safelight/[0.06] scale-[1.01]"
            : "border-dashed border-line bg-surface/40 hover:border-safelight/60 hover:bg-surface/70",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-16 w-16 items-center justify-center rounded-2xl border transition-colors",
            over
              ? "border-safelight bg-safelight/10 text-safelight"
              : "border-line bg-ink/60 text-safelight/80 group-hover:text-safelight",
          ].join(" ")}
        >
          <UploadIcon width={26} height={26} />
        </span>
        <span className="space-y-1.5">
          <span className="block font-display text-2xl text-paper">
            {over ? t("drophere") : t("headline")}
          </span>
          <span className="block text-sm text-muted">{t("hint")}</span>
        </span>
      </button>

      {error && (
        <p className="mt-3 text-center text-sm text-ember">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  );
}
