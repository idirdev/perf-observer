/**
 * Core types for the perf-observer package
 */

/** A single timing measurement */
export interface TimingEntry {
  /** Name/label of the measurement */
  name: string;
  /** Start time in milliseconds (high-resolution) */
  startTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** ISO timestamp of when the measurement started */
  timestamp: string;
  /** Optional metadata */
  meta?: Record<string, unknown>;
}

/** Aggregated metrics for a named measurement */
export interface AggregatedMetrics {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  total: number;
}

/** Memory snapshot at a point in time */
export interface MemorySnapshot {
  timestamp: string;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

/** Memory leak detection result */
export interface LeakReport {
  detected: boolean;
  growthRate: number;
  snapshots: MemorySnapshot[];
  message: string;
}

/** Reporter output format */
export type OutputFormat = 'table' | 'json' | 'csv';

/** Profiler session data */
export interface ProfileSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  entries: TimingEntry[];
  memorySnapshots: MemorySnapshot[];
}

/** Options for the retry/timeout decorator */
export interface TimeoutOptions {
  ms: number;
  message?: string;
}

/** Metric collector options */
export interface CollectorOptions {
  /** Maximum number of entries to keep per metric name */
  maxEntries?: number;
  /** Whether to auto-flush old entries when maxEntries is reached */
  autoFlush?: boolean;
}
