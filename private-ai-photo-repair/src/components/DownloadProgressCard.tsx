import type { DownloadProgress } from "../core/models/types";
import { ProgressBar } from "./ProgressBar";
import { formatBytes, formatSpeed, formatDuration } from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";

interface DownloadProgressCardProps {
  progress: DownloadProgress | null;
  onCancel: () => void;
}

const ACTIVE: DownloadProgress["status"][] = [
  "checking-cache",
  "downloading",
  "validating",
  "caching",
];

export function DownloadProgressCard({ progress, onCancel }: DownloadProgressCardProps): JSX.Element | null {
  const { t } = useI18n();
  if (!progress) return null;
  const isActive = ACTIVE.includes(progress.status);
  const isDownloading = progress.status === "downloading";

  const detail = (() => {
    if (progress.status === "downloading") {
      const total = progress.totalBytes;
      const parts: string[] = [];
      if (total) {
        parts.push(`${formatBytes(progress.downloadedBytes)} of ${formatBytes(total)}`);
      } else {
        parts.push(`${formatBytes(progress.downloadedBytes)} downloaded (total size unknown)`);
      }
      parts.push(formatSpeed(progress.speedBytesPerSecond));
      if (progress.estimatedSecondsRemaining !== null) {
        parts.push(`about ${formatDuration(progress.estimatedSecondsRemaining)} left`);
      }
      return parts.join(", ");
    }
    return progress.message;
  })();

  return (
    <section className="card">
      <div className="row spread">
        <h2>{t("download.title")}</h2>
        <span className="badge">{progress.status}</span>
      </div>
      <ProgressBar percentage={isDownloading ? progress.percentage : isActive ? null : 100} />
      <p className="muted" style={{ marginTop: 8 }}>{detail}</p>
      {progress.error && (
        <p className="muted" style={{ color: "var(--danger)" }}>{progress.error}</p>
      )}
      {isActive && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small danger" onClick={onCancel}>
            {t("download.cancel")}
          </button>
        </div>
      )}
    </section>
  );
}
