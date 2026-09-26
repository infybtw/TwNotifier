import { describe, expect, test } from "bun:test";
import { corsHeaders } from "./cors";

describe("corsHeaders", () => {
  test("allows a configured origin", () => {
    expect(corsHeaders("https://app.example.com", ["https://app.example.com"])).toMatchObject({
      "access-control-allow-origin": "https://app.example.com",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    });
  });

  test("does not allow an unconfigured origin", () => {
    expect(corsHeaders("https://evil.example.com", ["https://app.example.com"])).toEqual({});
  });

  test("does not add CORS headers without an Origin request header", () => {
    expect(corsHeaders(null, ["https://app.example.com"])).toEqual({});
  });
});
