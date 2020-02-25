/**
 * Collect and aggregate performance metrics: p50, p95, p99, avg, min, max
 */

import { TimingEntry, AggregatedMetrics, CollectorOptions } from './types';

/**
 * Calculate a percentile value from a sorted array of numbers.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * MetricsCollector stores timing entries grouped by name and
 * provides aggregation (min, max, avg, p50, p95, p99).
 */
export class MetricsCollector {
  private entries: Map<string, TimingEntry[]> = new Map();
  private options: Required<CollectorOptions>;

  constructor(options: CollectorOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries ?? 10_000,
      autoFlush: options.autoFlush ?? true,
    };
  }

  /** Record a timing entry */
  record(entry: TimingEntry): void {
    if (!this.entries.has(entry.name)) {
      this.entries.set(entry.name, []);
    }
    const list = this.entries.get(entry.name)!;
    list.push(entry);

    if (this.options.autoFlush && list.length > this.options.maxEntries) {
      // Remove oldest entries beyond the max
      const excess = list.length - this.options.maxEntries;
      list.splice(0, excess);
    }
  }

  /** Record a simple duration value without a full TimingEntry */
  recordValue(name: string, durationMs: number): void {
    this.record({
      name,
      startTime: 0,
      duration: durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  /** Get aggregated metrics for a specific named metric */
  aggregate(name: string): AggregatedMetrics | null {
    const list = this.entries.get(name);
    if (!list || list.length === 0) return null;

    const durations = list.map((e) => e.duration).sort((a, b) => a - b);
    const count = durations.length;
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      name,
      count,
      min: durations[0],
      max: durations[count - 1],
      avg: total / count,
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      total,
    };
  }

  /** Get aggregated metrics for all recorded metric names */
  aggregateAll(): AggregatedMetrics[] {
    const results: AggregatedMetrics[] = [];
    for (const name of this.entries.keys()) {
      const agg = this.aggregate(name);
      if (agg) results.push(agg);
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Get all metric names */
  getNames(): string[] {
    return [...this.entries.keys()].sort();
  }

  /** Get raw entries for a metric name */
  getEntries(name: string): TimingEntry[] {
    return [...(this.entries.get(name) ?? [])];
  }

  /** Get total entry count across all metrics */
  get totalCount(): number {
    let count = 0;
    for (const list of this.entries.values()) {
      count += list.length;
    }
    return count;
  }

  /** Clear all entries, or entries for a specific name */
  clear(name?: string): void {
    if (name) {
      this.entries.delete(name);
    } else {
      this.entries.clear();
    }
  }
}
