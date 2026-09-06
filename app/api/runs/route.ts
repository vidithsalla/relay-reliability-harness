import { NextResponse, type NextRequest } from "next/server";

import { createDemoSessionId, demoCookieOptions, DEMO_SESSION_COOKIE, isValidDemoSessionId } from "@/lib/demo/ids";
import { runDemoScenario } from "@/lib/services/demo-scenario-service";
import { listRuns } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const demoSessionId = demoSessionFromRequest(request) ?? createDemoSessionId();
  const response = NextResponse.json({ runs: await listRuns(demoSessionId) });
  setDemoCookieIfMissing(request, response, demoSessionId);
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scenarioId = String(body.scenarioId ?? "");
    const demoSessionId = demoSessionFromRequest(request) ?? createDemoSessionId();
    const result = await runDemoScenario(scenarioId, demoSessionId);
    const response = NextResponse.json(result, { status: 201 });
    setDemoCookieIfMissing(request, response, demoSessionId);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

function setDemoCookieIfMissing(request: NextRequest, response: NextResponse, demoSessionId: string) {
  if (!demoSessionFromRequest(request)) {
    response.cookies.set(DEMO_SESSION_COOKIE, demoSessionId, demoCookieOptions());
  }
}

function demoSessionFromRequest(request: NextRequest) {
  const value = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  return isValidDemoSessionId(value) ? value : null;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json(
    { error: { code: "RUN_CREATE_FAILED", message, retryable: false, details: {} } },
    { status: 400 }
  );
}
