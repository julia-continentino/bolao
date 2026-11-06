import { NextResponse } from "next/server";
import { aiConfigured, AI_MODEL } from "@/lib/ai/runtime";
import { secEnabled } from "@/lib/data/sec";

export async function GET() {
  return NextResponse.json({ ai: aiConfigured(), model: AI_MODEL, sec: secEnabled() });
}
