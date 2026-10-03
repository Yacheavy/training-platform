import { calculateTss, calculateKilojoules } from "@/lib/training-engine/tss";
import { calculateFueling } from "@/lib/training-engine/fueling";
import { NextResponse } from "next/server";

export async function GET() {
  // Simulamos el HIIT genuino que armamos en el boceto: 7x3min a 287W
  const blocks = [
    { type: "warmup", durationSec: 1800, targetWatts: 165 },
    { type: "interval", durationSec: 180, targetWatts: 287 },
    { type: "recovery", durationSec: 180, targetWatts: 144 },
    { type: "interval", durationSec: 180, targetWatts: 287 },
    { type: "recovery", durationSec: 180, targetWatts: 144 },
    { type: "interval", durationSec: 180, targetWatts: 287 },
    { type: "recovery", durationSec: 180, targetWatts: 144 },
    { type: "interval", durationSec: 180, targetWatts: 287 },
    { type: "recovery", durationSec: 180, targetWatts: 144 },
    { type: "interval", durationSec: 180, targetWatts: 287 },
    { type: "recovery", durationSec: 180, targetWatts: 144 },
    { type: "interval", durationSec: 180, targetWatts: 287 },
    { type: "recovery", durationSec: 180, targetWatts: 144 },
    { type: "interval", durationSec: 180, targetWatts: 287 },
    { type: "cooldown", durationSec: 900, targetWatts: 180 },
  ];

  const ftp = 254; // tu FTP de referencia usado en los bocetos

  return NextResponse.json({
    tss: calculateTss(blocks, ftp),
    kilojoules: calculateKilojoules(blocks),
    fueling: calculateFueling(blocks),
  });
}