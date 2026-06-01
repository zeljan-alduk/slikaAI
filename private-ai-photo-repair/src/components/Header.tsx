import { useI18n } from "../i18n/i18n";
import { useTheme } from "../theme/theme";

export function Header(): JSX.Element {
  const { t, lang, setLang } = useI18n();
  const { effective, toggle } = useTheme();

  return (
    <header className="header">
      <div className="title">
        <strong>{t("app.title")}</strong>
        <span className="tagline">{t("app.tagline")}</span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <span className="badge accent" title={t("header.privacyBadgeTitle")}>
          {t("header.privacyBadge")}
        </span>
        <div className="lang-switch" role="group" aria-label={t("header.lang.label")}>
          <button
            className={`small ${lang === "hr" ? "primary" : "ghost"}`}
            onClick={() => setLang("hr")}
            aria-pressed={lang === "hr"}
          >
            HR
          </button>
          <button
            className={`small ${lang === "en" ? "primary" : "ghost"}`}
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
          >
            EN
          </button>
        </div>
        <button
          className="small ghost"
          onClick={toggle}
          aria-label={effective === "dark" ? t("header.theme.toLight") : t("header.theme.toDark")}
          title={effective === "dark" ? t("header.theme.toLight") : t("header.theme.toDark")}
        >
          {effective === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}
