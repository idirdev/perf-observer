/**
 * High-resolution timer and function execution measurement
 */

import { TimingEntry } from './types';

/**
 * High-resolution timer using performance.now() or process.hrtime.bigint().
 * Provides nanosecond precision when available.
 */
export class Timer {
  private startNs: bigint | null = null;
  private endNs: bigint | null = null;
  private label: string;

  constructor(label: string = 'timer') {
    this.label = label;
  }

  /** Start the timer */
  start(): this {
    this.startNs = process.hrtime.bigint();
    this.endNs = null;
    return this;
  }

  /** Stop the timer and return elapsed milliseconds */
  stop(): number {
    if (this.startNs === null) {
      throw new Error('Timer was not started. Call .start() first.');
    }
    this.endNs = process.hrtime.bigint();
    return this.elapsedMs();
  }

  /** Get elapsed time in milliseconds (works while timer is still running) */
  elapsedMs(): number {
    if (this.startNs === null) return 0;
    const end = this.endNs ?? process.hrtime.bigint();
    return Number(end - this.startNs) / 1_000_000;
  }

  /** Get elapsed time in microseconds */
  elapsedUs(): number {
    if (this.startNs === null) return 0;
    const end = this.endNs ?? process.hrtime.bigint();
    return Number(end - this.startNs) / 1_000;
  }

  /** Convert the timer to a TimingEntry */
  toEntry(meta?: Record<string, unknown>): TimingEntry {
    return {
      name: this.label,
      startTime: Number(this.startNs ?? 0n) / 1_000_000,
      duration: this.elapsedMs(),
      timestamp: new Date().toISOString(),
      meta,
    };
  }

  /** Reset the timer */
  reset(): this {
    this.startNs = null;
    this.endNs = null;
    return this;
  }
}

/**
 * Measure the execution time of a synchronous function.
 * Returns the result and the timing entry.
 */
export function measureSync<T>(
  label: string,
  fn: () => T
): { result: T; timing: TimingEntry } {
  const timer = new Timer(label).start();
  const result = fn();
  timer.stop();
  return { result, timing: timer.toEntry() };
}

/**
 * Measure the execution time of an async function.
 * Returns the result and the timing entry.
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<{ result: T; timing: TimingEntry }> {
  const timer = new Timer(label).start();
  const result = await fn();
  timer.stop();
  return { result, timing: timer.toEntry() };
}

/**
 * Run a function multiple times and collect timing entries.
 * Useful for benchmarking.
 */
export async function benchmark(
  label: string,
  fn: () => void | Promise<void>,
  iterations: number = 100
): Promise<TimingEntry[]> {
  const entries: TimingEntry[] = [];
  for (let i = 0; i < iterations; i++) {
    const timer = new Timer(`${label}[${i}]`).start();
    await fn();
    timer.stop();
    entries.push(timer.toEntry({ iteration: i }));
  }
  return entries;
}
