import type { PipelineLogEntry } from "../core/progress/progressTypes";

interface TaskLogViewerProps {
  logs: PipelineLogEntry[];
  maxHeight?: number;
}

export function TaskLogViewer({ logs, maxHeight }: TaskLogViewerProps): JSX.Element {
  if (logs.length === 0) {
    return <p className="muted">No log entries yet.</p>;
  }
  return (
    <div className="logs" style={maxHeight ? { maxHeight } : undefined}>
      {logs.map((entry) => (
        <div className={`log-line ${entry.level}`} key={entry.id}>
          {new Date(entry.timestamp).toLocaleTimeString()} [{entry.source}] {entry.message}
        </div>
      ))}
    </div>
  );
}
