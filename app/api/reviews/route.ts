import { NextResponse } from "next/server";

import { listPendingReviews } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ reviews: await listPendingReviews() });
}
