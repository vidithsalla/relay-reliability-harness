import { NextResponse } from "next/server";

import { getRunDetail } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRunDetail(id);
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Run not found.", retryable: false, details: {} } },
      { status: 404 }
    );
  }
  return NextResponse.json(detail);
}
