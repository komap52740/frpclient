import { afterEach, describe, expect, it, vi } from "vitest";

import { createRequestId } from "./requestId";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createRequestId", () => {
  it("uses crypto.randomUUID when available", () => {
    const randomUUID = vi.fn(() => "uuid-from-crypto");
    vi.stubGlobal("crypto", { randomUUID });

    expect(createRequestId()).toBe("uuid-from-crypto");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generated identifier when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});

    const requestId = createRequestId();

    expect(requestId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/i);
    expect(requestId.length).toBeGreaterThanOrEqual(8);
  });
});
