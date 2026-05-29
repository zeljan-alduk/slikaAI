"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter, routing } from "@/i18n/routing";

const LABELS: Record<string, string> = {
  en: "EN",
  hr: "HR",
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-line bg-surface/70 p-0.5 backdrop-blur"
      data-pending={isPending ? "" : undefined}
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => switchTo(l)}
            aria-pressed={active}
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors",
              active
                ? "bg-safelight text-[#1a0f08]"
                : "text-paper-dim hover:text-paper",
            ].join(" ")}
          >
            {LABELS[l] ?? l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
