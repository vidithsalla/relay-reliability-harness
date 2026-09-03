import { describe, expect, it } from "vitest";

import { canonicalJson, deriveIdempotencyKey } from "@/lib/domain/canonical-json";

describe("canonical json and idempotency", () => {
  it("canonicalizes object key order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });

  it("derives stable idempotency keys from semantic inputs", () => {
    const first = deriveIdempotencyKey({
      canonicalVersion: "relay-v1",
      logicalRunNamespace: "run",
      actionOrdinal: 1,
      actionType: "SET_RESERVE",
      argumentsJson: { reserveAmountCents: 840000 }
    });
    const second = deriveIdempotencyKey({
      canonicalVersion: "relay-v1",
      logicalRunNamespace: "run",
      actionOrdinal: 1,
      actionType: "SET_RESERVE",
      argumentsJson: { reserveAmountCents: 840000 }
    });
    expect(first).toBe(second);
  });
});
