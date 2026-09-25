import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  test("allows requests up to the limit and rejects the rest", () => {
    const limiter = createRateLimiter(2);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(false);
  });

  test("tracks keys independently", () => {
    const limiter = createRateLimiter(1);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("b")).toBe(true);
    expect(limiter.take("a")).toBe(false);
  });

  test("reset clears all counters", () => {
    const limiter = createRateLimiter(1);
    limiter.take("a");
    expect(limiter.take("a")).toBe(false);
    limiter.reset();
    expect(limiter.take("a")).toBe(true);
  });
});
