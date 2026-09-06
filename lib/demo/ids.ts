import { randomUUID } from "node:crypto";

export const DEMO_SESSION_COOKIE = "relay_demo_session";

const SESSION_PATTERN = /^demo_[a-f0-9-]{36}$/;

export function isValidDemoSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_PATTERN.test(value);
}

export function createDemoSessionId(): string {
  return `demo_${randomUUID()}`;
}

export function demoActorId(sessionId: string): string {
  return `demo:${sessionId}`;
}

export function demoReviewerActorId(sessionId: string): string {
  return `reviewer:${sessionId}`;
}

export function demoClaimId(baseClaimId: string, sessionId: string): string {
  return `${baseClaimId}--${sessionId.slice(5, 13)}`;
}

export function demoCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };
}
