import { buildBlocks } from "@/lib/training-engine/block-builder";
import { NextResponse } from "next/server";

export async function GET() {
  const billat = buildBlocks("billat_30_30", 60, 254, 100, 116);
  const ronnestad = buildBlocks("ronnestad_30_15", 60, 254, 125, 135);

  return NextResponse.json({
    billat_intervals: billat.filter((b) => b.type === "interval" || b.type === "recovery").slice(0, 4),
    ronnestad_intervals: ronnestad.filter((b) => b.type === "interval" || b.type === "recovery").slice(0, 4),
  });
}