import { NextResponse } from "next/server";

import { latestEvalRun } from "@/lib/eval/eval-suite";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ latest: await latestEvalRun() });
}
