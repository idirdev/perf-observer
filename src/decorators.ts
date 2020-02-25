/**
 * TypeScript decorators for performance instrumentation:
 * @measure, @cache, @timeout
 */

import { Timer } from './timer';

/**
 * @measure decorator — automatically measures method execution time
 * and logs it. Works with both sync and async methods.
 *
 * @example
 * class MyService {
 *   @measure
 *   async fetchData() { ... }
 * }
 */
export function measure(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  const className = target.constructor?.name ?? 'Unknown';

  descriptor.value = function (...args: unknown[]) {
    const label = `${className}.${propertyKey}`;
    const timer = new Timer(label).start();

    const result = originalMethod.apply(this, args);

    // Handle async methods
    if (result instanceof Promise) {
      return result.then(
        (value: unknown) => {
          const duration = timer.stop();
          console.log(`[perf] ${label}: ${duration.toFixed(2)}ms`);
          return value;
        },
        (error: unknown) => {
          const duration = timer.stop();
          console.log(`[perf] ${label}: ${duration.toFixed(2)}ms (ERROR)`);
          throw error;
        }
      );
    }

    const duration = timer.stop();
    console.log(`[perf] ${label}: ${duration.toFixed(2)}ms`);
    return result;
  };

  return descriptor;
}

/**
 * @cache decorator — memoizes method results based on serialized arguments.
 * Supports a TTL (time-to-live) in milliseconds.
 *
 * @example
 * class MyService {
 *   @cache({ ttl: 60000 })
 *   getUser(id: string) { ... }
 * }
 */
export function cache(options: { ttl?: number; maxSize?: number } = {}) {
  const { ttl = Infinity, maxSize = 1000 } = options;

  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const cacheMap = new Map<string, { value: unknown; expiresAt: number }>();

    descriptor.value = function (...args: unknown[]) {
      const key = JSON.stringify(args);
      const now = Date.now();

      // Check cache hit
      const cached = cacheMap.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      // Evict expired entries if approaching maxSize
      if (cacheMap.size >= maxSize) {
        for (const [k, v] of cacheMap) {
          if (v.expiresAt <= now) cacheMap.delete(k);
        }
        // If still over max, remove oldest
        if (cacheMap.size >= maxSize) {
          const firstKey = cacheMap.keys().next().value;
          if (firstKey !== undefined) cacheMap.delete(firstKey);
        }
      }

      const result = originalMethod.apply(this, args);

      // Handle async results
      if (result instanceof Promise) {
        return result.then((value: unknown) => {
          cacheMap.set(key, { value, expiresAt: now + ttl });
          return value;
        });
      }

      cacheMap.set(key, { value: result, expiresAt: now + ttl });
      return result;
    };

    return descriptor;
  };
}

/**
 * @timeout decorator — wraps an async method with a timeout.
 * Rejects with a TimeoutError if the method takes longer than `ms`.
 *
 * @example
 * class MyService {
 *   @timeout({ ms: 5000, message: 'Request timed out' })
 *   async fetchData() { ... }
 * }
 */
export function timeout(options: { ms: number; message?: string }) {
  const { ms, message } = options;

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = target.constructor?.name ?? 'Unknown';
    const label = `${className}.${propertyKey}`;

    descriptor.value = function (...args: unknown[]) {
      const result = originalMethod.apply(this, args);

      if (!(result instanceof Promise)) {
        return result; // Only wrap async methods
      }

      const timeoutMsg = message ?? `${label} timed out after ${ms}ms`;

      return Promise.race([
        result,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(timeoutMsg)), ms);
        }),
      ]);
    };

    return descriptor;
  };
}
