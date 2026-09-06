import { NextResponse, type NextRequest } from "next/server";

import { createDemoSessionId, demoCookieOptions, DEMO_SESSION_COOKIE, isValidDemoSessionId } from "@/lib/demo/ids";
import { listPendingReviews } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const value = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  const demoSessionId = isValidDemoSessionId(value) ? value : createDemoSessionId();
  const response = NextResponse.json({ reviews: await listPendingReviews(demoSessionId) });
  if (!isValidDemoSessionId(value)) {
    response.cookies.set(DEMO_SESSION_COOKIE, demoSessionId, demoCookieOptions());
  }
  return response;
}
