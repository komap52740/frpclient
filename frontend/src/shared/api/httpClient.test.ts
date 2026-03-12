import { describe, expect, it } from "vitest";

import { resolveRequestCachePolicy, withBypassCache } from "./httpClient";

describe("http client cache policy", () => {
  it("defaults to standard cache policy", () => {
    expect(resolveRequestCachePolicy(undefined)).toBe("default");
    expect(resolveRequestCachePolicy({})).toBe("default");
  });

  it("marks request config for explicit cache bypass", () => {
    const config = withBypassCache({
      params: { is_read: 0 },
      metadata: { requestId: "request-123" },
    });

    expect(config.metadata?.cachePolicy).toBe("bypass");
    expect(config.metadata?.requestId).toBe("request-123");
    expect(resolveRequestCachePolicy(config)).toBe("bypass");
  });
});
