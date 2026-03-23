import { describe, expect, it, vi } from "vitest";

import { getFromCache, setToCache } from "./cache";

describe("cache", () => {
  it("returns cached value before ttl expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));

    setToCache("k1", { ok: true }, 5000);
    expect(getFromCache<{ ok: boolean }>("k1")).toEqual({ ok: true });

    vi.useRealTimers();
  });

  it("returns null after ttl expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));

    setToCache("k2", "value", 1000);
    vi.setSystemTime(new Date("2026-01-01T10:00:02.000Z"));

    expect(getFromCache<string>("k2")).toBeNull();

    vi.useRealTimers();
  });
});
