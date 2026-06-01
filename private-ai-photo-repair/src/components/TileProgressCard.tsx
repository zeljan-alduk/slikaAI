import type { TileProgress } from "../core/progress/progressTypes";
import { ProgressBar } from "./ProgressBar";
import { formatDuration } from "../core/progress/formatters";

interface TileProgressCardProps {
  progress: TileProgress | null;
  active: boolean;
}

export function TileProgressCard({ progress, active }: TileProgressCardProps): JSX.Element | null {
  if (!progress || progress.totalTiles <= 1) return null;
  if (!active && progress.completedTiles >= progress.totalTiles) {
    // keep visible after completion as a summary
  }
  return (
    <section className="card">
      <h2>Tile progress</h2>
      <p className="muted" style={{ marginBottom: 8 }}>
        Processing tile {Math.min(progress.completedTiles + (active ? 1 : 0), progress.totalTiles)} of{" "}
        {progress.totalTiles}
      </p>
      <ProgressBar percentage={progress.overallTilePercentage} />
      <p className="muted" style={{ marginTop: 8 }}>
        {progress.overallTilePercentage}% overall
        {progress.estimatedSecondsRemaining !== null
          ? ` — about ${formatDuration(progress.estimatedSecondsRemaining)} left`
          : ""}
      </p>
    </section>
  );
}
