import { NextResponse, type NextRequest } from "next/server";

import { listRuns, createAndStartRun } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ runs: await listRuns() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createAndStartRun({
      claimId: String(body.claimId),
      requestText: String(body.requestText),
      plannerMode: body.plannerMode === "grok" ? "grok" : "deterministic",
      faultProfileId: body.faultProfileId ?? "none",
      scenarioId: body.scenarioId ?? null,
      actorId: body.actorId ?? "operator"
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json(
    { error: { code: "RUN_CREATE_FAILED", message, retryable: false, details: {} } },
    { status: 400 }
  );
}
