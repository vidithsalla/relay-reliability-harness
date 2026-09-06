import { NextResponse, type NextRequest } from "next/server";

import { DEMO_SESSION_COOKIE, isValidDemoSessionId } from "@/lib/demo/ids";
import { replayRun } from "@/lib/services/run-service";
import { resetClaimFixtures, resetDemoClaimFixture } from "@/lib/services/seed-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({ resetFixture: true }));
  const demoSessionId = demoSessionFromRequest(request);
  const detail = await import("@/lib/services/run-service").then((mod) => mod.getRunDetail(id, demoSessionId));
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Run not found.", retryable: false, details: {} } },
      { status: 404 }
    );
  }
  if (body.resetFixture !== true) {
    return NextResponse.json(
      { error: { code: "RESET_REQUIRED", message: "Seeded replay requires resetFixture: true.", retryable: false, details: {} } },
      { status: 400 }
    );
  }
  if (demoSessionId) {
    await resetDemoClaimFixture(baseClaimId(detail.run.claim_id), demoSessionId);
  } else {
    await resetClaimFixtures([detail.run.claim_id]);
  }
  const result = await replayRun(id, demoSessionId);
  return NextResponse.json(result, { status: 201 });
}

function demoSessionFromRequest(request: NextRequest) {
  const value = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  return isValidDemoSessionId(value) ? value : null;
}

function baseClaimId(claimId: string) {
  return claimId.split("--")[0];
}
