import { setRequestLocale, getTranslations } from "next-intl/server";
import Editor from "@/components/Editor";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default async function Home(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 sm:px-8">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl italic tracking-tight text-paper">
            slika
          </span>
          <span className="rounded-md bg-safelight px-1.5 py-0.5 text-xs font-bold tracking-wide text-[#1a0f08]">
            AI
          </span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Hero */}
      <section className="pb-8 pt-6 sm:pt-10">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-safelight/90">
          <span className="dot-pulse">●</span>
          {t("hero.kicker")}
        </p>
        <h1 className="max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-paper sm:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-paper-dim sm:text-lg">
          {t("hero.subtitle")}
        </p>
      </section>

      {/* Editor */}
      <main className="flex-1 pb-10">
        <div className="rounded-[calc(var(--radius-xl2)+0.4rem)] border border-line bg-ink-soft/60 p-3 shadow-[0_30px_80px_-40px_rgba(240,137,74,0.3)] sm:p-5">
          <Editor />
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-1 border-t border-line-soft py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>{t("footer.built")}</span>
        <span className="max-w-md sm:text-right">{t("footer.privacy")}</span>
      </footer>
    </div>
  );
}
