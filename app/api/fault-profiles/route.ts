import { NextResponse } from "next/server";

import { seededFaultProfiles } from "@/lib/fixtures/fault-profiles";

export async function GET() {
  return NextResponse.json({ faultProfiles: seededFaultProfiles });
}
