interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): JSX.Element | null {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>Something went wrong</strong>
        <div className="muted" style={{ color: "inherit" }}>
          {message}
        </div>
      </div>
      <button className="small ghost" onClick={onDismiss} aria-label="Dismiss error">
        ✕
      </button>
    </div>
  );
}
