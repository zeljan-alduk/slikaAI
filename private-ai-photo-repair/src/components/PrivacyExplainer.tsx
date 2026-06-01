import { useI18n } from "../i18n/i18n";

export function PrivacyExplainer(): JSX.Element {
  const { t } = useI18n();
  return (
    <details className="card privacy collapsible">
      <summary>
        <span className="summary-title">🔒 {t("privacy.title")}</span>
      </summary>
      <p className="muted">{t("privacy.body")}</p>
      <ul>
        <li>{t("privacy.p1")}</li>
        <li>{t("privacy.p2")}</li>
        <li>{t("privacy.p3")}</li>
        <li>{t("privacy.p4")}</li>
        <li>{t("privacy.p5")}</li>
      </ul>
    </details>
  );
}
