import { describe, expect, test } from "bun:test";
import { ServiceError } from "./errors";
import { updateUserSettings } from "./settings";

describe("updateUserSettings validation", () => {
  test("rejects unknown fields", async () => {
    await expect(updateUserSettings(1, { isAdmin: true })).rejects.toThrow(ServiceError);
  });

  test("rejects non-boolean toggles", async () => {
    await expect(updateUserSettings(1, { onlineNotification: 1 })).rejects.toThrow(ServiceError);
  });

  test("rejects unsupported languages", async () => {
    await expect(updateUserSettings(1, { language: "de" })).rejects.toThrow(ServiceError);
  });
});
