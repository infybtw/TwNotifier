import { describe, expect, test } from "bun:test";
import { toLiveStatusDto } from "./dto";

describe("toLiveStatusDto", () => {
  test("carries the stream preview url", () => {
    const dto = toLiveStatusDto({
      state: "online",
      title: "Stream",
      viewers: 42,
      previewUrl: "https://cdn.example/preview.jpg",
      checkedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(dto.status).toBe("online");
    expect(dto.previewUrl).toBe("https://cdn.example/preview.jpg");
  });

  test("omits the preview url when the provider has none", () => {
    const dto = toLiveStatusDto({
      state: "online",
      checkedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(dto.previewUrl).toBeUndefined();
  });
});
