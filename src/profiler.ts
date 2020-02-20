/**
 * CPU profiling wrapper and session management
 */

import { ProfileSession, TimingEntry, MemorySnapshot } from './types';
import { Timer } from './timer';
import { takeSnapshot } from './memory';

let sessionCounter = 0;

/**
 * Profiler manages a profiling session, collecting timing entries
 * and memory snapshots for an entire workflow or request lifecycle.
 */
export class Profiler {
  private session: ProfileSession;
  private activeTimers: Map<string, Timer> = new Map();

  constructor(id?: string) {
    sessionCounter++;
    this.session = {
      id: id ?? `session-${sessionCounter}-${Date.now()}`,
      startedAt: new Date().toISOString(),
      entries: [],
      memorySnapshots: [],
    };
  }

  /** Get the session ID */
  get id(): string {
    return this.session.id;
  }

  /** Start a named timer within this profiling session */
  startMark(name: string): void {
    if (this.activeTimers.has(name)) {
      throw new Error(`Timer "${name}" is already running in session ${this.session.id}`);
    }
    const timer = new Timer(name).start();
    this.activeTimers.set(name, timer);
  }

  /** End a named timer and record the entry */
  endMark(name: string, meta?: Record<string, unknown>): TimingEntry {
    const timer = this.activeTimers.get(name);
    if (!timer) {
      throw new Error(`No active timer "${name}" in session ${this.session.id}`);
    }
    timer.stop();
    const entry = timer.toEntry(meta);
    this.session.entries.push(entry);
    this.activeTimers.delete(name);
    return entry;
  }

  /** Record a memory snapshot in this session */
  snapshot(): MemorySnapshot {
    const snap = takeSnapshot();
    this.session.memorySnapshots.push(snap);
    return snap;
  }

  /**
   * Wrap an async function with automatic timing.
   * Starts a mark before execution and ends it after.
   */
  async wrap<T>(
    name: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    this.startMark(name);
    try {
      const result = await fn();
      this.endMark(name, { ...meta, success: true });
      return result;
    } catch (error) {
      this.endMark(name, {
        ...meta,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Wrap a synchronous function with automatic timing.
   */
  wrapSync<T>(
    name: string,
    fn: () => T,
    meta?: Record<string, unknown>
  ): T {
    this.startMark(name);
    try {
      const result = fn();
      this.endMark(name, { ...meta, success: true });
      return result;
    } catch (error) {
      this.endMark(name, {
        ...meta,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** End the profiling session */
  end(): ProfileSession {
    this.session.endedAt = new Date().toISOString();
    // Force-end any remaining active timers
    for (const [name, timer] of this.activeTimers) {
      timer.stop();
      this.session.entries.push(timer.toEntry({ forceStopped: true }));
    }
    this.activeTimers.clear();
    return this.getSession();
  }

  /** Get the full session data */
  getSession(): ProfileSession {
    return { ...this.session, entries: [...this.session.entries] };
  }

  /** Get all timing entries */
  getEntries(): TimingEntry[] {
    return [...this.session.entries];
  }

  /** Get the total duration of all recorded entries */
  totalDuration(): number {
    return this.session.entries.reduce((sum, e) => sum + e.duration, 0);
  }
}
