import type { TileProgress } from "../core/progress/progressTypes";
import { ProgressBar } from "./ProgressBar";
import { formatDuration } from "../core/progress/formatters";
import { useI18n } from "../i18n/i18n";

interface TileProgressCardProps {
  progress: TileProgress | null;
  active: boolean;
}

export function TileProgressCard({ progress, active }: TileProgressCardProps): JSX.Element | null {
  const { t } = useI18n();
  if (!progress || progress.totalTiles <= 1) return null;
  const current = Math.min(progress.completedTiles + (active ? 1 : 0), progress.totalTiles);
  return (
    <section className="card">
      <h2>{t("tile.title")}</h2>
      <p className="muted" style={{ marginBottom: 8 }}>
        {t("tile.processing", { current, total: progress.totalTiles })}
      </p>
      <ProgressBar percentage={progress.overallTilePercentage} />
      <p className="muted" style={{ marginTop: 8 }}>
        {t("tile.overall", { pct: progress.overallTilePercentage })}
        {progress.estimatedSecondsRemaining !== null
          ? t("tile.eta", { time: formatDuration(progress.estimatedSecondsRemaining) })
          : ""}
      </p>
    </section>
  );
}
