import { describe, expect, it } from "vitest";

import { authSessionSchema, meResponseSchema, parseApiPayload } from "./models";

describe("auth models", () => {
  it("parses auth session payloads with access token", () => {
    const payload = parseApiPayload(
      authSessionSchema,
      {
        access: "token-123",
        user: {
          id: 7,
          username: "client-user",
          role: "client",
        },
      },
      "passwordLogin"
    );

    expect(payload.access).toBe("token-123");
    expect(payload.user?.username).toBe("client-user");
  });

  it("rejects invalid session payloads", () => {
    expect(() => parseApiPayload(authSessionSchema, { access: "" }, "passwordLogin")).toThrow(
      "passwordLogin response shape is invalid"
    );
  });

  it("parses me payloads with payment settings passthrough", () => {
    const payload = parseApiPayload(
      meResponseSchema,
      {
        user: {
          id: 2,
          username: "b2b-client",
          role: "client",
        },
        payment_settings: {
          card_number: "****1234",
          support: "@frpnnow",
        },
      },
      "getMe"
    );

    expect(payload.user?.id).toBe(2);
    expect(payload.payment_settings?.support).toBe("@frpnnow");
  });
});
