import { describe, expect, test } from "bun:test";
import { decodeCursor, encodeCursor, parseLimit } from "./pagination";

describe("pagination", () => {
  test("cursor round-trips an offset", () => {
    expect(decodeCursor(encodeCursor(0))).toBe(0);
    expect(decodeCursor(encodeCursor(40))).toBe(40);
  });

  test("invalid cursors fall back to the first page", () => {
    expect(decodeCursor(undefined)).toBe(0);
    expect(decodeCursor("!!!not-base64!!!")).toBe(0);
    expect(decodeCursor(Buffer.from("-5").toString("base64url"))).toBe(0);
  });

  test("limits are bounded", () => {
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit("10")).toBe(10);
    expect(parseLimit("0")).toBe(20);
    expect(parseLimit("9999")).toBe(50);
    expect(parseLimit("abc")).toBe(20);
  });
});
