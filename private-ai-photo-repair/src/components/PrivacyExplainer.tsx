import { useI18n } from "../i18n/i18n";

export function PrivacyExplainer(): JSX.Element {
  const { t } = useI18n();
  return (
    <section className="card privacy">
      <h2>{t("privacy.title")}</h2>
      <p className="muted">{t("privacy.body")}</p>
      <ul>
        <li>{t("privacy.p1")}</li>
        <li>{t("privacy.p2")}</li>
        <li>{t("privacy.p3")}</li>
        <li>{t("privacy.p4")}</li>
        <li>{t("privacy.p5")}</li>
      </ul>
    </section>
  );
}
