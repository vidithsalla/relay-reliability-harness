import { NextResponse } from "next/server";

import { decideReview } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await decideReview({
      reviewId: id,
      decision: body.decision,
      note: body.note,
      actorId: body.actorId ?? "reviewer"
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
