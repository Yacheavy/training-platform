import { dayKeyDate } from "@/lib/tz";

/** "hoy" / "(ayer)" / "(hace N d)" según la fecha del último dato. */
export function ageLabel(d: Date | null): string {
  if (!d) return "";
  const days = Math.round((dayKeyDate(new Date()).getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "(ayer)";
  return `(hace ${days} d)`;
}

const comma = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

interface TrendInput {
  hrvDeltaPct: number | null;
  hrvMethod: string | null;
  restingHrDeltaAbs: number | null;
  restingHrMethod: string | null;
}

/** Textos de tendencia de HRV y FC en reposo; son los mismos criterios del semáforo (media de 7 días contra la línea base). */
export function recoveryTrends(a: TrendInput): { hrvTrend: string | undefined; rhrTrend: string | undefined } {
  const hrvTrend =
    a.hrvDeltaPct != null
      ? `${a.hrvDeltaPct > 0 ? "↑" : "↓"} ${comma(Math.abs(a.hrvDeltaPct))}% ${a.hrvMethod === "baseline" ? "media 7 d vs tu base" : "hoy vs 6 días previos"}`
      : undefined;
  const rhrTrend =
    a.restingHrDeltaAbs != null
      ? `${a.restingHrDeltaAbs > 0 ? "↑" : "↓"} ${comma(Math.abs(a.restingHrDeltaAbs))} lpm ${a.restingHrMethod === "baseline" ? "media 7 d vs tu base" : "hoy vs 6 días previos"}`
      : undefined;
  return { hrvTrend, rhrTrend };
}
