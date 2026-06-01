import type {
  PipelineLogEntry,
  LogLevel,
  LogSource,
} from "../progress/progressTypes";

let counter = 0;

function nextId(): string {
  counter += 1;
  return `log_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function createLogEntry(
  level: LogLevel,
  source: LogSource,
  message: string,
  details?: Record<string, unknown>,
): PipelineLogEntry {
  const entry: PipelineLogEntry = {
    id: nextId(),
    timestamp: Date.now(),
    level,
    source,
    message,
  };
  if (details) entry.details = details;
  return entry;
}

export type LogSink = (entry: PipelineLogEntry) => void;

/**
 * Lightweight logger that mirrors entries to a sink (used both on the main
 * thread and inside the worker, where the sink posts back to the main thread).
 */
export class Logger {
  private readonly source: LogSource;
  private readonly sink: LogSink;

  constructor(source: LogSource, sink: LogSink) {
    this.source = source;
    this.sink = sink;
  }

  private emit(level: LogLevel, message: string, details?: Record<string, unknown>): void {
    this.sink(createLogEntry(level, this.source, message, details));
  }

  debug(message: string, details?: Record<string, unknown>): void {
    this.emit("debug", message, details);
  }

  info(message: string, details?: Record<string, unknown>): void {
    this.emit("info", message, details);
  }

  warn(message: string, details?: Record<string, unknown>): void {
    this.emit("warn", message, details);
  }

  error(message: string, details?: Record<string, unknown>): void {
    this.emit("error", message, details);
  }
}
