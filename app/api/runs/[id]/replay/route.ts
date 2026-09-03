import { NextResponse } from "next/server";

import { replayRun } from "@/lib/services/run-service";
import { resetClaimFixtures } from "@/lib/services/seed-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({ resetFixture: true }));
  const detail = await import("@/lib/services/run-service").then((mod) => mod.getRunDetail(id));
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
  await resetClaimFixtures([detail.run.claim_id]);
  const result = await replayRun(id);
  return NextResponse.json(result, { status: 201 });
}
