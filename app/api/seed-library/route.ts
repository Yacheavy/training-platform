import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const LIBRARY = [
  { key: "z2", name: "Z2 / Base aeróbica", intensityPctFtpLow: 56, intensityPctFtpHigh: 75, maxSessionsPerWeek: null, evidenceSource: "Seiler (modelo 80/20)", notes: "Volumen semanal, fondos" },
  { key: "sweet_spot", name: "Sweet Spot", intensityPctFtpLow: 88, intensityPctFtpHigh: 94, maxSessionsPerWeek: null, evidenceSource: "Coggan (práctica de coaching)", notes: "Táctico, tiempo limitado" },
  { key: "umbral", name: "Umbral (Seiler LI)", intensityPctFtpLow: 95, intensityPctFtpHigh: 105, maxSessionsPerWeek: 2, evidenceSource: "Seiler 2013", notes: "Elevar umbral de lactato" },
  { key: "hiit_genuino", name: "HIIT genuino", intensityPctFtpLow: 108, intensityPctFtpHigh: 115, maxSessionsPerWeek: 1, evidenceSource: "Chicharro & Vicente-Campos 2018", notes: "VO2max, protocolo oro fisiológico" },
  { key: "ronnestad_30_15", name: "30/15 Rønnestad", intensityPctFtpLow: 125, intensityPctFtpHigh: 135, maxSessionsPerWeek: null, evidenceSource: "Rønnestad 2015/2020", notes: "VO2max eficiente en tiempo" },
  { key: "billat_30_30", name: "Billat 30-30", intensityPctFtpLow: 110, intensityPctFtpHigh: 116, maxSessionsPerWeek: null, evidenceSource: "Billat", notes: "Máximo tiempo en VO2max" },
  { key: "rst", name: "RST — repeated sprint", intensityPctFtpLow: 150, intensityPctFtpHigh: 180, maxSessionsPerWeek: null, evidenceSource: "Chicharro & Vicente-Campos 2018", notes: "Potencia neuromuscular" },
  { key: "gym", name: "Gimnasio", intensityPctFtpLow: null, intensityPctFtpHigh: null, maxSessionsPerWeek: null, evidenceSource: "N/A", notes: "Fuerza, no aplica FTP" },
];

export async function GET() {
  for (const entry of LIBRARY) {
    await prisma.workoutLibraryEntry.upsert({
      where: { key: entry.key },
      update: entry,
      create: entry,
    });
  }
  return NextResponse.json({ seeded: LIBRARY.length });
}