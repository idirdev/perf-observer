import { describe, it, expect } from 'vitest';
import { Timer, measureSync, measureAsync, benchmark } from '../src/timer';
import { MetricsCollector } from '../src/metrics';
import { Profiler } from '../src/profiler';
import { MemoryTracker, takeSnapshot, formatBytes } from '../src/memory';

describe('Timer', () => {
  it('should create a timer with a label', () => {
    const timer = new Timer('test-timer');
    expect(timer).toBeDefined();
  });

  it('should return 0 elapsed when not started', () => {
    const timer = new Timer('test');
    expect(timer.elapsedMs()).toBe(0);
    expect(timer.elapsedUs()).toBe(0);
  });

  it('should measure elapsed time after start and stop', () => {
    const timer = new Timer('test').start();
    // Do a small busy wait
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    const elapsed = timer.stop();
    expect(elapsed).toBeGreaterThan(0);
    expect(timer.elapsedMs()).toBeGreaterThan(0);
  });

  it('should throw when stopping a timer that was not started', () => {
    const timer = new Timer('test');
    expect(() => timer.stop()).toThrow('Timer was not started');
  });

  it('should reset the timer', () => {
    const timer = new Timer('test').start();
    timer.stop();
    timer.reset();
    expect(timer.elapsedMs()).toBe(0);
  });

  it('should convert to a TimingEntry', () => {
    const timer = new Timer('my-label').start();
    timer.stop();
    const entry = timer.toEntry({ key: 'value' });
    expect(entry.name).toBe('my-label');
    expect(entry.duration).toBeGreaterThanOrEqual(0);
    expect(entry.timestamp).toBeDefined();
    expect(entry.meta).toEqual({ key: 'value' });
  });

  it('should support method chaining on start and reset', () => {
    const timer = new Timer('test');
    const started = timer.start();
    expect(started).toBe(timer);
    const reset = timer.reset();
    expect(reset).toBe(timer);
  });
});

describe('measureSync', () => {
  it('should measure synchronous function execution', () => {
    const { result, timing } = measureSync('add', () => 2 + 3);
    expect(result).toBe(5);
    expect(timing.name).toBe('add');
    expect(timing.duration).toBeGreaterThanOrEqual(0);
  });

  it('should return the function result', () => {
    const { result } = measureSync('concat', () => 'hello' + ' world');
    expect(result).toBe('hello world');
  });
});

describe('measureAsync', () => {
  it('should measure async function execution', async () => {
    const { result, timing } = await measureAsync('async-op', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    });
    expect(result).toBe(42);
    expect(timing.name).toBe('async-op');
    expect(timing.duration).toBeGreaterThanOrEqual(5);
  });
});

describe('benchmark', () => {
  it('should run a function multiple times and collect entries', async () => {
    let count = 0;
    const entries = await benchmark('counter', () => { count++; }, 10);
    expect(entries).toHaveLength(10);
    expect(count).toBe(10);
    entries.forEach((entry, i) => {
      expect(entry.name).toBe(`counter[${i}]`);
      expect(entry.meta?.iteration).toBe(i);
    });
  });
});

describe('MetricsCollector', () => {
  it('should record and aggregate metrics', () => {
    const collector = new MetricsCollector();
    collector.recordValue('api-call', 10);
    collector.recordValue('api-call', 20);
    collector.recordValue('api-call', 30);

    const agg = collector.aggregate('api-call');
    expect(agg).not.toBeNull();
    expect(agg!.name).toBe('api-call');
    expect(agg!.count).toBe(3);
    expect(agg!.min).toBe(10);
    expect(agg!.max).toBe(30);
    expect(agg!.avg).toBe(20);
    expect(agg!.total).toBe(60);
  });

  it('should return null for unknown metric names', () => {
    const collector = new MetricsCollector();
    expect(collector.aggregate('unknown')).toBeNull();
  });

  it('should record full TimingEntry objects', () => {
    const collector = new MetricsCollector();
    collector.record({
      name: 'op',
      startTime: 0,
      duration: 50,
      timestamp: new Date().toISOString(),
    });
    const entries = collector.getEntries('op');
    expect(entries).toHaveLength(1);
    expect(entries[0].duration).toBe(50);
  });

  it('should calculate percentiles correctly', () => {
    const collector = new MetricsCollector();
    for (let i = 1; i <= 100; i++) {
      collector.recordValue('perf', i);
    }
    const agg = collector.aggregate('perf')!;
    expect(agg.p50).toBeCloseTo(50.5, 0);
    expect(agg.p95).toBeCloseTo(95.05, 0);
    expect(agg.p99).toBeCloseTo(99.01, 0);
  });

  it('should aggregate all metrics', () => {
    const collector = new MetricsCollector();
    collector.recordValue('a', 10);
    collector.recordValue('b', 20);
    const all = collector.aggregateAll();
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.name).sort()).toEqual(['a', 'b']);
  });

  it('should track total count across all metrics', () => {
    const collector = new MetricsCollector();
    collector.recordValue('x', 1);
    collector.recordValue('x', 2);
    collector.recordValue('y', 3);
    expect(collector.totalCount).toBe(3);
  });

  it('should clear metrics', () => {
    const collector = new MetricsCollector();
    collector.recordValue('a', 10);
    collector.recordValue('b', 20);
    collector.clear('a');
    expect(collector.getNames()).toEqual(['b']);
    collector.clear();
    expect(collector.totalCount).toBe(0);
  });

  it('should auto-flush old entries beyond maxEntries', () => {
    const collector = new MetricsCollector({ maxEntries: 5 });
    for (let i = 0; i < 10; i++) {
      collector.recordValue('metric', i);
    }
    const entries = collector.getEntries('metric');
    expect(entries).toHaveLength(5);
    // oldest entries should have been removed
    expect(entries[0].duration).toBe(5);
  });
});

describe('Profiler', () => {
  it('should create a profiler with an id', () => {
    const profiler = new Profiler('test-session');
    expect(profiler.id).toBe('test-session');
  });

  it('should auto-generate a session id', () => {
    const profiler = new Profiler();
    expect(profiler.id).toMatch(/^session-/);
  });

  it('should start and end marks', () => {
    const profiler = new Profiler('test');
    profiler.startMark('operation');
    const entry = profiler.endMark('operation', { step: 1 });
    expect(entry.name).toBe('operation');
    expect(entry.duration).toBeGreaterThanOrEqual(0);
    expect(entry.meta?.step).toBe(1);
  });

  it('should throw when starting a duplicate mark', () => {
    const profiler = new Profiler('test');
    profiler.startMark('op');
    expect(() => profiler.startMark('op')).toThrow('already running');
  });

  it('should throw when ending a non-existent mark', () => {
    const profiler = new Profiler('test');
    expect(() => profiler.endMark('nope')).toThrow('No active timer');
  });

  it('should wrap sync functions', () => {
    const profiler = new Profiler('test');
    const result = profiler.wrapSync('calc', () => 2 * 21);
    expect(result).toBe(42);
    const entries = profiler.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].meta?.success).toBe(true);
  });

  it('should wrap async functions', async () => {
    const profiler = new Profiler('test');
    const result = await profiler.wrap('async-calc', async () => {
      return 'done';
    });
    expect(result).toBe('done');
    const entries = profiler.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].meta?.success).toBe(true);
  });

  it('should track errors in wrapped functions', () => {
    const profiler = new Profiler('test');
    expect(() =>
      profiler.wrapSync('fail', () => { throw new Error('boom'); })
    ).toThrow('boom');
    const entries = profiler.getEntries();
    expect(entries[0].meta?.success).toBe(false);
    expect(entries[0].meta?.error).toBe('boom');
  });

  it('should end a session and force-stop active timers', () => {
    const profiler = new Profiler('test');
    profiler.startMark('still-running');
    const session = profiler.end();
    expect(session.endedAt).toBeDefined();
    expect(session.entries).toHaveLength(1);
    expect(session.entries[0].meta?.forceStopped).toBe(true);
  });

  it('should calculate total duration', () => {
    const profiler = new Profiler('test');
    profiler.wrapSync('a', () => {});
    profiler.wrapSync('b', () => {});
    expect(profiler.totalDuration()).toBeGreaterThanOrEqual(0);
  });
});

describe('MemoryTracker', () => {
  it('should take and record a memory snapshot', () => {
    const tracker = new MemoryTracker();
    const snap = tracker.record();
    expect(snap.heapUsed).toBeGreaterThan(0);
    expect(snap.rss).toBeGreaterThan(0);
    expect(snap.timestamp).toBeDefined();
  });

  it('should track multiple snapshots', () => {
    const tracker = new MemoryTracker();
    tracker.record();
    tracker.record();
    tracker.record();
    expect(tracker.getSnapshots()).toHaveLength(3);
  });

  it('should return the latest snapshot', () => {
    const tracker = new MemoryTracker();
    expect(tracker.latest()).toBeNull();
    tracker.record();
    tracker.record();
    const latest = tracker.latest();
    expect(latest).not.toBeNull();
  });

  it('should detect no leak with insufficient snapshots', () => {
    const tracker = new MemoryTracker();
    tracker.record();
    const report = tracker.detectLeaks();
    expect(report.detected).toBe(false);
    expect(report.message).toContain('Not enough snapshots');
  });

  it('should clear all snapshots', () => {
    const tracker = new MemoryTracker();
    tracker.record();
    tracker.record();
    tracker.clear();
    expect(tracker.getSnapshots()).toHaveLength(0);
  });

  it('should limit max snapshots', () => {
    const tracker = new MemoryTracker(5);
    for (let i = 0; i < 10; i++) {
      tracker.record();
    }
    expect(tracker.getSnapshots()).toHaveLength(5);
  });
});

describe('takeSnapshot', () => {
  it('should return a valid memory snapshot', () => {
    const snap = takeSnapshot();
    expect(snap.heapUsed).toBeGreaterThan(0);
    expect(snap.heapTotal).toBeGreaterThan(0);
    expect(snap.rss).toBeGreaterThan(0);
    expect(snap.external).toBeGreaterThanOrEqual(0);
    expect(snap.arrayBuffers).toBeGreaterThanOrEqual(0);
    expect(snap.timestamp).toBeDefined();
  });
});

describe('formatBytes', () => {
  it('should format zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500.00 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });
});
