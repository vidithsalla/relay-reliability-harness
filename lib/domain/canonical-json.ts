import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function inputHash(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function deriveIdempotencyKey(input: {
  canonicalVersion: string;
  logicalRunNamespace: string;
  actionOrdinal: number;
  actionType: string;
  argumentsJson: unknown;
}): string {
  return sha256(
    [
      input.canonicalVersion,
      input.logicalRunNamespace,
      input.actionOrdinal,
      input.actionType,
      canonicalJson(input.argumentsJson)
    ].join(":")
  );
}
