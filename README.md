# 📈 Perf Observer

A comprehensive performance monitoring toolkit for Node.js and TypeScript applications. High-resolution timers, memory tracking, CPU profiling, metrics aggregation, and TypeScript decorators.

## Installation

```bash
npm install @idirdev/perf-observer
```

## Quick Start

```typescript
import {
  Timer, measureAsync, MetricsCollector, Reporter, Profiler, measure
} from '@idirdev/perf-observer';

// Measure a function
const { result, timing } = await measureAsync('db-query', () => db.query('SELECT ...'));
console.log(`Query took ${timing.duration.toFixed(2)}ms`);

// Collect and aggregate metrics
const collector = new MetricsCollector();
collector.record(timing);
const report = new Reporter();
report.print(collector.aggregateAll());
```

## Features

### Timer (`timer.ts`)
- High-resolution timing via `process.hrtime.bigint()` (nanosecond precision)
- `measureSync()` / `measureAsync()` — wrap any function with automatic timing
- `benchmark()` — run a function N times and collect timing entries

### Memory Tracking (`memory.ts`)
- `takeSnapshot()` — capture current heap, RSS, external memory
- `MemoryTracker` — periodic snapshot collection with configurable intervals
- Leak detection via linear regression on heap growth over time

### Profiler (`profiler.ts`)
- Session-based profiling with start/end marks
- `wrap()` / `wrapSync()` — instrument async/sync functions
- Automatic memory snapshots within sessions

### Metrics Aggregation (`metrics.ts`)
- `MetricsCollector` — store and aggregate timing entries by name
- Percentiles: p50, p95, p99 plus min, max, avg, total
- Configurable max entries with auto-flush

### Reporter (`reporter.ts`)
- Format metrics as ASCII table, JSON, or CSV
- `Reporter` class with `report()` and `print()` methods

### Decorators (`decorators.ts`)
- `@measure` — log method execution time automatically
- `@cache({ ttl, maxSize })` — memoize with TTL and eviction
- `@timeout({ ms })` — reject async methods that exceed a time limit

## License

MIT

---

## 🇫🇷 Documentation en français

### Description
Perf Observer est une boîte à outils complète de surveillance des performances pour les applications Node.js et TypeScript. Elle offre des minuteries haute résolution, un suivi de la mémoire, le profilage CPU, l'agrégation de métriques et des décorateurs TypeScript pour instrumenter facilement votre code.

### Installation
```bash
npm install @idirdev/perf-observer
```

### Utilisation
```typescript
import { measureAsync, MetricsCollector, Reporter } from '@idirdev/perf-observer';

const { result, timing } = await measureAsync('ma-requete', () => db.query('SELECT ...'));
console.log(`Durée : ${timing.duration.toFixed(2)}ms`);
```

Consultez la documentation anglaise ci-dessus pour les détails sur le Timer, le MemoryTracker, le Profiler, les métriques et les décorateurs.
