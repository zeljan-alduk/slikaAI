import type { PipelineLogEntry } from "../core/progress/progressTypes";

interface TaskLogViewerProps {
  logs: PipelineLogEntry[];
  maxHeight?: number;
}

export function TaskLogViewer({ logs, maxHeight }: TaskLogViewerProps): JSX.Element {
  if (logs.length === 0) {
    return <p className="muted">No log entries yet.</p>;
  }
  // Only render the most recent entries to keep re-renders cheap.
  const visible = logs.length > 150 ? logs.slice(logs.length - 150) : logs;
  return (
    <div className="logs" style={maxHeight ? { maxHeight } : undefined}>
      {visible.map((entry) => (
        <div className={`log-line ${entry.level}`} key={entry.id}>
          {new Date(entry.timestamp).toLocaleTimeString()} [{entry.source}] {entry.message}
        </div>
      ))}
    </div>
  );
}
