interface Bucket {
  timestamps: number[];
}

export interface RateLimiter {
  /** Returns true when the request is allowed. */
  take(key: string): boolean;
  reset(): void;
}

/**
 * Small in-memory sliding-window limiter. Sufficient for a single-process bot;
 * shared state would be required for multiple instances.
 */
export function createRateLimiter(limitPerMinute: number): RateLimiter {
  const windowMs = 60_000;
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  function sweep(now: number): void {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
      if (bucket.timestamps.length === 0) buckets.delete(key);
    }
  }

  return {
    take(key: string): boolean {
      const now = Date.now();
      sweep(now);
      const bucket = buckets.get(key) ?? { timestamps: [] };
      bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
      if (bucket.timestamps.length >= limitPerMinute) {
        buckets.set(key, bucket);
        return false;
      }
      bucket.timestamps.push(now);
      buckets.set(key, bucket);
      return true;
    },
    reset(): void {
      buckets.clear();
    },
  };
}
