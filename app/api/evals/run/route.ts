import { NextResponse } from "next/server";

import { runEvalSuite } from "@/lib/eval/eval-suite";
import { canRunEvalMutation } from "@/lib/eval/permissions";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!canRunEvalMutation()) {
    return NextResponse.json(
      {
        error: {
          code: "EVAL_MUTATION_DISABLED",
          message: "Running evals is disabled in the hosted demo.",
          retryable: false,
          details: {}
        }
      },
      { status: 403 }
    );
  }
  const result = await runEvalSuite();
  return NextResponse.json(result, { status: result.failed > 0 ? 500 : 201 });
}
