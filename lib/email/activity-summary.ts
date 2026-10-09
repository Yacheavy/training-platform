import { prisma } from "@/lib/prisma";
import { ensureActivityLaps, shortEfforts, type StoredLaps } from "@/lib/laps";
import { ensureActivityWeather, type ActivityWeather } from "@/lib/weather";
import { NUTRITION_SELECT, toNutritionInput } from "@/lib/nutrition-data";
import { toSessionNutrition } from "@/lib/training-engine/nutrition-analysis";
import { appUrl } from "./mailer";

/** Resumen de una salida SIN IA: solo datos de la actividad y cuentas hechas en código. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n0 = (v: number | null | undefined, u = "") => (v == null ? "—" : `${Math.round(v)}${u}`);
const dec = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const pct = (real: number, plan: number) => `${real >= plan ? "+" : "−"}${dec(Math.abs(((real - plan) / plan) * 100)).replace(/,0$/, "")}%`;

function weatherText(w: ActivityWeather): string | null {
  const parts: string[] = [];
  const x = w.weather;
  if (x && (x.temp != null || x.feels != null)) {
    const bits: string[] = [];
    if (x.temp != null) bits.push(`${Math.round(x.temp)} °C${x.feels != null ? ` (sensación ${Math.round(x.feels)} °C)` : ""}`);
    if (x.windKmh != null) bits.push(`viento ${Math.round(x.windKmh)} km/h${x.gustKmh != null ? ` con ráfagas de ${Math.round(x.gustKmh)}` : ""}`);
    if (x.clouds != null) bits.push(`nubosidad ${Math.round(x.clouds)}%`);
    if (x.rain != null && x.rain > 0) bits.push(`lluvia hasta ${dec(x.rain)} mm/h`);
    parts.push(`${bits.join(" · ")}. Estimado por ${x.source === "intervals" ? "Intervals.icu" : "Open-Meteo"} para la zona y la hora de la salida, no medido en el lugar.`);
  }
  if (w.deviceTemp?.avg != null) parts.push(`Sensor de tu dispositivo: ${Math.round(w.deviceTemp.avg)} °C de media${w.deviceTemp.min != null && w.deviceTemp.max != null ? ` (${Math.round(w.deviceTemp.min)}–${Math.round(w.deviceTemp.max)} °C)` : ""}.`);
  return parts.length ? parts.join("<br>") : null;
}

export interface SummaryEmail { title: string; subtitle: string; bodyHtml: string; text: string; activityId: string }

async function loadRow(activityId: string) {
  return prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      ...NUTRITION_SELECT,
      type: true, normalizedPower: true, avgPower: true, avgHr: true, maxHr: true, avgCadence: true, kilojoules: true,
      athlete: { select: { ftp: true } },
      generatedWorkout: { select: { suggestedCarbsGPerHour: true, estimatedTss: true, blocksJson: true } },
    },
  });
}
export type SummaryRow = NonNullable<Awaited<ReturnType<typeof loadRow>>>;

export async function buildActivitySummary(activityId: string): Promise<SummaryEmail | null> {
  const a = await loadRow(activityId);
  if (!a) return null;
  const outdoor = RIDE.has(a.type) && a.type !== "VirtualRide";
  const laps = RIDE.has(a.type) ? await ensureActivityLaps(a.id).catch(() => null) : null;
  const weather = outdoor ? await ensureActivityWeather(a.id).catch(() => ({ weather: null, deviceTemp: null })) : { weather: null, deviceTemp: null };
  return renderActivitySummary(a, laps, weather);
}

/** Parte pura (sin base de datos ni red): arma el resumen a partir de los datos ya cargados. */
export function renderActivitySummary(a: SummaryRow, laps: StoredLaps | null, weather: ActivityWeather): SummaryEmail {
  const ift = a.intensityFactor != null ? (a.intensityFactor > 3 ? a.intensityFactor / 100 : a.intensityFactor) : null;
  const min = Math.round(a.durationSec / 60);
  const text: string[] = [];

  const cell = (label: string, value: string) =>
    `<td width="33%" style="padding:0 8px 12px 0;vertical-align:top"><div style="font-size:11.5px;color:#8A97A6;margin:0 0 2px">${esc(label)}</div><div style="font-size:17px;font-weight:600;color:#E7ECF2">${esc(value)}</div></td>`;
  const row = (cells: string[]) => `<tr>${cells.join("")}</tr>`;
  const grid = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 6px">${row([
    cell("Duración", `${min} min`), cell("TSS", n0(a.tss)), cell("IF", ift != null ? dec(ift, 2) : "—"),
  ])}${row([cell("Potencia normalizada", n0(a.normalizedPower, " W")), cell("Potencia media", n0(a.avgPower, " W")), cell("Trabajo", n0(a.kilojoules, " kJ"))])}${row([
    cell("FC media", n0(a.avgHr, " lpm")), cell("FC máxima", n0(a.maxHr, " lpm")), cell("Desacople Pw:HR", a.decouplingPct != null ? `${dec(a.decouplingPct)}%` : "—"),
  ])}</table>`;
  text.push(`Duración ${min} min · TSS ${n0(a.tss)} · IF ${ift != null ? dec(ift, 2) : "—"} · NP ${n0(a.normalizedPower, " W")} · Potencia media ${n0(a.avgPower, " W")} · FC media ${n0(a.avgHr, " lpm")} · Desacople ${a.decouplingPct != null ? `${dec(a.decouplingPct)}%` : "—"}`);

  const section = (title: string, color: string, body: string) =>
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 0;border-top:1px solid #2A3441"><tr><td style="padding:14px 0 4px;font-size:15px;font-weight:600;color:${color}">${esc(title)}</td></tr><tr><td style="font-size:14.5px;line-height:1.65;color:#C5CED8;padding:0 0 10px">${body}</td></tr></table>`;
  const sections: string[] = [];

  if (a.generatedWorkout) {
    const planMin = Math.round((a.generatedWorkout.blocksJson as unknown as { durationSec?: number }[]).reduce((s, b) => s + (b.durationSec ?? 0), 0) / 60);
    const planTss = a.generatedWorkout.estimatedTss;
    const line = `Duración: ${min} min contra ${planMin} planeados (${pct(min, planMin)})${a.tss != null && planTss ? `. TSS: ${Math.round(a.tss)} contra ${planTss} planeado (${pct(a.tss, planTss)})` : ""}.`;
    sections.push(section("Plan y real", "#4FD1C5", esc(line)));
    text.push(`Plan y real. ${line}`);
  }

  if (RIDE.has(a.type)) {
    const se = laps ? shortEfforts(laps.laps, a.athlete.ftp) : null;
    if (se) {
      const line = `${se.list.length} esfuerzos cortos de alta potencia, en orden: ${se.list.map((l) => `${l.avgW} W`).join(", ")}. El más fuerte fue el ${se.strongest + 1}º y el más flojo el ${se.weakest + 1}º.`;
      sections.push(section("Esfuerzos", "#E8A33D", esc(line)));
      text.push(`Esfuerzos. ${line}`);
    }
  }

  const nut = toSessionNutrition(toNutritionInput(a));
  const ni = toNutritionInput(a);
  if (ni.carbsG != null || ni.fluidMl != null) {
    const bits: string[] = [];
    if (ni.carbsG != null && nut.carbsPerHour != null) {
      const r = nut.ratio;
      const v = r == null ? "" : r >= 1.15 ? ", por encima de lo sugerido" : r >= 0.9 ? ", en línea con lo sugerido" : ", por debajo de lo sugerido";
      bits.push(`Carbohidratos: ${Math.round(ni.carbsG)} g (${Math.round(nut.carbsPerHour)} g/h${nut.targetGPerHour > 0 ? ` contra ${Math.round(nut.targetGPerHour)} g/h sugeridos${v}` : ""}).`);
    }
    if (ni.fluidMl != null && nut.fluidPerHour != null) {
      const f = Math.round(nut.fluidPerHour);
      bits.push(`Líquido: ${ni.fluidMl} ml (${f} ml/h${nut.hours >= 1 ? (f < 400 ? ", por debajo del rango orientativo de 400–800 ml/h" : f <= 800 ? ", dentro del rango orientativo de 400–800 ml/h" : ", por encima del rango orientativo de 400–800 ml/h") : ""}).`);
    }
    if (ni.sodiumMg != null) bits.push(`Sodio: ${ni.sodiumMg} mg.`);
    sections.push(section("Nutrición", "#7FB2F0", bits.map(esc).join("<br>")));
    text.push(`Nutrición. ${bits.join(" ")}`);
  }

  {
    const wt = weatherText(weather);
    if (wt) {
      sections.push(section("Clima", "#8A97A6", wt));
      text.push(`Clima. ${wt.replace(/<br>/g, " ")}`);
    }
  }

  const cta = appUrl() ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#8A97A6">¿Querés una lectura con IA de esta salida? Abrila en la app y tocá «Analizá la sesión».</p>` : "";
  const when = a.date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return {
    title: `Resumen de tu salida: ${a.name ?? "salida de bici"}`,
    subtitle: `${when} · ${min} min${a.tss != null ? ` · TSS ${Math.round(a.tss)}` : ""}`,
    bodyHtml: `${grid}${sections.join("")}${cta}`,
    text: text.join("\n\n"),
    activityId: a.id,
  };
}

const RIDE = new Set(["Ride", "VirtualRide", "GravelRide", "MountainBikeRide", "EBikeRide"]);
