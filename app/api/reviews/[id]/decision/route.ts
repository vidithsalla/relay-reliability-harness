import { NextResponse, type NextRequest } from "next/server";

import { DEMO_SESSION_COOKIE, demoReviewerActorId, isValidDemoSessionId } from "@/lib/demo/ids";
import { decideReview } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const demoSessionId = demoSessionFromRequest(request);
    if (!demoSessionId) throw new Error("Demo session cookie is required.");
    const decision = String(body.decision);
    if (decision !== "APPROVE" && decision !== "REJECT") throw new Error("Invalid review decision.");
    const result = await decideReview({
      reviewId: id,
      decision,
      note: body.note,
      actorId: demoReviewerActorId(demoSessionId),
      demoSessionId
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: { code: "REVIEW_DECISION_FAILED", message, retryable: false, details: {} } },
      { status: message.includes("version") ? 409 : 400 }
    );
  }
}

function demoSessionFromRequest(request: NextRequest) {
  const value = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  return isValidDemoSessionId(value) ? value : null;
}
