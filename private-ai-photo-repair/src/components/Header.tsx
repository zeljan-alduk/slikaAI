import { useI18n } from "../i18n/i18n";
import { useTheme } from "../theme/theme";
import { LogoMark, SunIcon, MoonIcon } from "./Icons";

export function Header(): JSX.Element {
  const { t, lang, setLang } = useI18n();
  const { effective, toggle } = useTheme();

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">
          <LogoMark size={22} />
        </span>
        <div className="title">
          <strong>{t("app.title")}</strong>
          <span className="tagline">{t("app.tagline")}</span>
        </div>
      </div>

      <div className="header-controls">
        <div className="segmented" role="group" aria-label={t("header.lang.label")}>
          <button onClick={() => setLang("hr")} aria-pressed={lang === "hr"}>
            HR
          </button>
          <button onClick={() => setLang("en")} aria-pressed={lang === "en"}>
            EN
          </button>
        </div>
        <button
          className="icon-btn"
          onClick={toggle}
          aria-label={effective === "dark" ? t("header.theme.toLight") : t("header.theme.toDark")}
          title={effective === "dark" ? t("header.theme.toLight") : t("header.theme.toDark")}
        >
          {effective === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </div>
    </header>
  );
}
