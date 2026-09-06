import { cookies } from "next/headers";

import { createDemoSessionId, demoCookieOptions, DEMO_SESSION_COOKIE, isValidDemoSessionId } from "@/lib/demo/ids";

export {
  createDemoSessionId,
  demoActorId,
  demoClaimId,
  demoCookieOptions,
  demoReviewerActorId,
  DEMO_SESSION_COOKIE,
  isValidDemoSessionId
} from "@/lib/demo/ids";

export async function getOrCreateDemoSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEMO_SESSION_COOKIE)?.value;
  if (isValidDemoSessionId(existing)) {
    return existing;
  }
  const created = createDemoSessionId();
  store.set(DEMO_SESSION_COOKIE, created, demoCookieOptions());
  return created;
}

export async function getDemoSessionId(): Promise<string | null> {
  const value = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  return isValidDemoSessionId(value) ? value : null;
}
