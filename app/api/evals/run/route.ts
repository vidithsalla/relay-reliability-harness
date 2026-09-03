import { NextResponse } from "next/server";

import { runEvalSuite } from "@/lib/eval/eval-suite";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await runEvalSuite();
  return NextResponse.json(result, { status: result.failed > 0 ? 500 : 201 });
}
