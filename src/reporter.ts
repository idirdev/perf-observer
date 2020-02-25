/**
 * Format metrics as table, JSON, or CSV
 */

import { AggregatedMetrics, OutputFormat } from './types';

/**
 * Format a number to a fixed number of decimal places, stripping trailing zeros.
 */
function fmt(n: number, decimals: number = 2): string {
  return Number(n.toFixed(decimals)).toString();
}

/**
 * Generate a formatted table string from aggregated metrics.
 * Produces a well-aligned ASCII table with headers and separators.
 */
function formatTable(metrics: AggregatedMetrics[]): string {
  if (metrics.length === 0) return '(no metrics recorded)';

  const headers = ['Name', 'Count', 'Min', 'Max', 'Avg', 'P50', 'P95', 'P99', 'Total'];

  const rows = metrics.map((m) => [
    m.name,
    String(m.count),
    `${fmt(m.min)}ms`,
    `${fmt(m.max)}ms`,
    `${fmt(m.avg)}ms`,
    `${fmt(m.p50)}ms`,
    `${fmt(m.p95)}ms`,
    `${fmt(m.p99)}ms`,
    `${fmt(m.total)}ms`,
  ]);

  // Calculate column widths
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );

  const pad = (str: string, width: number) => str.padEnd(width);
  const separator = colWidths.map((w) => '-'.repeat(w)).join('-+-');

  const headerLine = headers.map((h, i) => pad(h, colWidths[i])).join(' | ');
  const dataLines = rows.map((row) =>
    row.map((cell, i) => pad(cell, colWidths[i])).join(' | ')
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

/**
 * Generate a JSON string from aggregated metrics.
 */
function formatJson(metrics: AggregatedMetrics[]): string {
  return JSON.stringify(metrics, null, 2);
}

/**
 * Generate a CSV string from aggregated metrics.
 * Includes a header row.
 */
function formatCsv(metrics: AggregatedMetrics[]): string {
  const headers = ['name', 'count', 'min', 'max', 'avg', 'p50', 'p95', 'p99', 'total'];
  const lines = [headers.join(',')];

  for (const m of metrics) {
    const row = [
      `"${m.name}"`,
      String(m.count),
      fmt(m.min, 4),
      fmt(m.max, 4),
      fmt(m.avg, 4),
      fmt(m.p50, 4),
      fmt(m.p95, 4),
      fmt(m.p99, 4),
      fmt(m.total, 4),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Format aggregated metrics into the specified output format.
 */
export function formatMetrics(metrics: AggregatedMetrics[], format: OutputFormat): string {
  switch (format) {
    case 'table':
      return formatTable(metrics);
    case 'json':
      return formatJson(metrics);
    case 'csv':
      return formatCsv(metrics);
    default:
      throw new Error(`Unknown output format: ${format}`);
  }
}

/**
 * Reporter class wraps a MetricsCollector-compatible source and generates reports.
 */
export class Reporter {
  private defaultFormat: OutputFormat;

  constructor(defaultFormat: OutputFormat = 'table') {
    this.defaultFormat = defaultFormat;
  }

  /** Generate a report from aggregated metrics */
  report(metrics: AggregatedMetrics[], format?: OutputFormat): string {
    const fmt = format ?? this.defaultFormat;
    const header = `Performance Report (${new Date().toISOString()})\n${'='.repeat(60)}\n\n`;
    const body = formatMetrics(metrics, fmt);
    const footer = `\n\n${'='.repeat(60)}\nTotal metrics: ${metrics.length} | Total samples: ${metrics.reduce((s, m) => s + m.count, 0)}`;
    return header + body + footer;
  }

  /** Print a report directly to console */
  print(metrics: AggregatedMetrics[], format?: OutputFormat): void {
    console.log(this.report(metrics, format));
  }
}
