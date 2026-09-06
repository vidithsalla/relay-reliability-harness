import { NextResponse, type NextRequest } from "next/server";

import { DEMO_SESSION_COOKIE, isValidDemoSessionId } from "@/lib/demo/ids";
import { getRunDetail } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRunDetail(id, demoSessionFromRequest(request));
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Run not found.", retryable: false, details: {} } },
      { status: 404 }
    );
  }
  return NextResponse.json(detail);
}

function demoSessionFromRequest(request: NextRequest) {
  const value = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  return isValidDemoSessionId(value) ? value : null;
}
