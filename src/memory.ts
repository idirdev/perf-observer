/**
 * Memory usage tracking and leak detection
 */

import { MemorySnapshot, LeakReport } from './types';

/** Take a snapshot of current memory usage */
export function takeSnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    rss: mem.rss,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
  };
}

/** Format bytes into a human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, exp);
  return `${value.toFixed(2)} ${units[exp]}`;
}

/**
 * MemoryTracker collects periodic snapshots and can detect potential leaks
 * by analyzing the growth trend of heap usage over time.
 */
export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private maxSnapshots: number;

  constructor(maxSnapshots: number = 1000) {
    this.maxSnapshots = maxSnapshots;
  }

  /** Take a snapshot and store it */
  record(): MemorySnapshot {
    const snapshot = takeSnapshot();
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
    return snapshot;
  }

  /**
   * Start automatic periodic snapshots.
   * @param intervalMs Interval between snapshots in milliseconds (default: 5000)
   */
  startTracking(intervalMs: number = 5000): void {
    if (this.intervalId !== null) return;
    this.record(); // initial snapshot
    this.intervalId = setInterval(() => this.record(), intervalMs);
    // Unref so the interval doesn't prevent process exit
    if (this.intervalId && typeof this.intervalId === 'object' && 'unref' in this.intervalId) {
      (this.intervalId as NodeJS.Timeout).unref();
    }
  }

  /** Stop automatic tracking */
  stopTracking(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Get all collected snapshots */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /** Get the latest snapshot */
  latest(): MemorySnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /**
   * Analyze snapshots for potential memory leaks.
   * Uses linear regression on heapUsed to determine growth trend.
   * A positive, consistent slope above threshold indicates a potential leak.
   */
  detectLeaks(thresholdBytesPerSec: number = 1024 * 100): LeakReport {
    if (this.snapshots.length < 3) {
      return {
        detected: false,
        growthRate: 0,
        snapshots: this.getSnapshots(),
        message: 'Not enough snapshots for leak detection (need at least 3)',
      };
    }

    // Calculate growth rate via linear regression
    const n = this.snapshots.length;
    const times: number[] = this.snapshots.map((s) => new Date(s.timestamp).getTime());
    const heaps: number[] = this.snapshots.map((s) => s.heapUsed);

    const t0 = times[0];
    const xs = times.map((t) => (t - t0) / 1000); // seconds from start
    const ys = heaps;

    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const growthRate = Math.max(0, slope); // bytes per second

    const detected = growthRate > thresholdBytesPerSec;

    return {
      detected,
      growthRate,
      snapshots: this.getSnapshots(),
      message: detected
        ? `Potential memory leak detected: heap growing at ${formatBytes(growthRate)}/s`
        : `No leak detected. Heap growth rate: ${formatBytes(growthRate)}/s`,
    };
  }

  /** Clear all snapshots */
  clear(): void {
    this.snapshots = [];
  }
}
