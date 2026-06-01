import { useI18n } from "../i18n/i18n";

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): JSX.Element | null {
  const { t } = useI18n();
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>{t("error.title")}</strong>
        <div className="muted" style={{ color: "inherit" }}>
          {message}
        </div>
      </div>
      <button className="small ghost" onClick={onDismiss} aria-label={t("error.dismiss")}>
        ✕
      </button>
    </div>
  );
}
