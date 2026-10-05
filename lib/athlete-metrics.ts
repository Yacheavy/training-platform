import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
import { getPowerCurve, getSportSettings } from "@/lib/intervals-client";
import { getIntervalsCreds } from "@/lib/intervals-creds";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const POWER_CURVE_DURATIONS = [5, 60, 300, 1200, 3600] as const;
export const DURATION_LABEL: Record<number, string> = { 5: "5 s", 60: "1 min", 300: "5 min", 1200: "20 min", 3600: "60 min" };

export interface StoredPowerCurve {
  window: string;
  fetchedAt: string;
  points: { secs: number; watts: number }[];
  error?: string;
  sample?: string;
}
export interface StoredSportSettings {
  fetchedAt: string;
  ftp: number | null;
  indoorFtp: number | null;
  lthr: number | null;
  maxHr: number | null;
  error?: string;
  sample?: string;
}

const num = (v: any): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

/** Extrae los mejores esfuerzos a duraciones fijas. Tolera variaciones de forma de la respuesta. */
export function parsePowerCurve(res: any, window: string): StoredPowerCurve {
  const fetchedAt = new Date().toISOString();
  const curve = Array.isArray(res?.list) ? res.list[0] : Array.isArray(res) ? res[0] : res;
  const secs: number[] | undefined = curve?.secs;
  const watts: number[] | undefined = curve?.watts;
  if (!Array.isArray(secs) || !Array.isArray(watts) || secs.length === 0) {
    return { window, fetchedAt, points: [], error: "Respuesta de Intervals no reconocida", sample: JSON.stringify(res).slice(0, 600) };
  }
  const points: { secs: number; watts: number }[] = [];
  for (const target of POWER_CURVE_DURATIONS) {
    if (Math.max(...secs) < target) continue; // la curva no llega a esa duración
    let idx = secs.indexOf(target);
    if (idx < 0) {
      // Último punto con secs <= target (la curva es monótona decreciente en watts)
      for (let i = 0; i < secs.length; i++) if (secs[i] <= target) idx = i;
    }
    const wv = idx >= 0 ? num(watts[idx]) : null;
    if (wv) points.push({ secs: target, watts: wv });
  }
  return { window, fetchedAt, points };
}

export function parseSportSettings(res: any): StoredSportSettings {
  const fetchedAt = new Date().toISOString();
  const list: any[] = Array.isArray(res) ? res : Array.isArray(res?.list) ? res.list : res ? [res] : [];
  const ride =
    list.find((s) => Array.isArray(s?.types) && s.types.includes("Ride")) ??
    list.find((s) => s?.type === "Ride") ??
    list.find((s) => num(s?.ftp));
  if (!ride) return { fetchedAt, ftp: null, indoorFtp: null, lthr: null, maxHr: null, error: "Respuesta de Intervals no reconocida", sample: JSON.stringify(res).slice(0, 600) };
  return { fetchedAt, ftp: num(ride.ftp), indoorFtp: num(ride.indoor_ftp), lthr: num(ride.lthr), maxHr: num(ride.max_hr) };
}

/** Trae curva de potencia (90 días) y configuración de deporte desde Intervals y las guarda. Nunca lanza. */
export async function refreshAthleteMetrics(userId: string): Promise<string[]> {
  const errors: string[] = [];
  const creds = await getIntervalsCreds(userId);
  if (!creds) return ["Intervals no está conectado"];
  const { apiKey, athleteId } = creds;

  const data: Prisma.UserUpdateInput = {};
  try {
    data.powerCurveJson = parsePowerCurve(await getPowerCurve(athleteId, apiKey, "90d"), "90d") as unknown as Prisma.InputJsonValue;
    data.powerCurveSyncedAt = new Date();
  } catch (err) {
    errors.push(`Curva de potencia: ${String(err)}`);
  }
  try {
    data.sportSettingsJson = parseSportSettings(await getSportSettings(athleteId, apiKey)) as unknown as Prisma.InputJsonValue;
  } catch (err) {
    errors.push(`Configuración de deporte: ${String(err)}`);
  }
  if (Object.keys(data).length) await prisma.user.update({ where: { id: userId }, data });
  return errors;
}
