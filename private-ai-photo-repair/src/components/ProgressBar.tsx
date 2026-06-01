interface ProgressBarProps {
  /** 0-100, or null for indeterminate. */
  percentage: number | null;
}

export function ProgressBar({ percentage }: ProgressBarProps): JSX.Element {
  const indeterminate = percentage === null;
  const width = indeterminate ? 35 : Math.max(0, Math.min(100, percentage));
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={indeterminate ? undefined : width}>
      <div
        className={`progress-fill${indeterminate ? " indeterminate" : ""}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
