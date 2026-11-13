import { planSituation, minutesOf, type PlannedSession } from "./training-engine/situation";
import { buildBlocks } from "./training-engine/block-builder";
import { calculateTss } from "./training-engine/tss";

let problems = 0;
const ok = (c: boolean, m: string) => { if (!c) { problems++; console.log("FALLA:", m); } };
const ftp = 230;
const mk = (id: string, dayKey: string, key: string, min: number, status = "SENT_TO_INTERVALS"): PlannedSession => ({ id, dayKey, key, blocks: key === "gym" || key === "flexibility" ? ([{ type: "gym", durationSec: min * 60, targetWatts: 0 }] as never) : buildBlocks(key, min, ftp, null, null), status });
const week: PlannedSession[] = [
  mk("a", "2026-11-12", "umbral", 90), mk("b", "2026-11-13", "gym", 55), mk("c", "2026-11-14", "long_durability", 180),
  mk("d", "2026-11-15", "z2", 60), mk("e", "2026-11-16", "flexibility", 30), mk("f", "2026-11-17", "ronnestad_30_15", 80),
  mk("g", "2026-11-18", "gym", 55), mk("h", "2026-11-19", "z2", 120),
  mk("past", "2026-11-11", "umbral", 90, "COMPLETED"),
];
const today = "2026-11-12";

// Fiebre / síntomas generales
const body = planSituation("sick_body", today, week, ftp);
const by = (p: ReturnType<typeof planSituation>, id: string) => p.actions.find((a) => a.workoutId === id);
ok(by(body, "a")?.kind === "rest" && by(body, "b")?.kind === "rest" && by(body, "c")?.kind === "rest", "3 días de descanso completo (hoy, +1, +2)");
ok(by(body, "d") === undefined, "día +3: rodaje Z2 de 60 min queda igual (sin acción)");
ok(by(body, "e") === undefined, "día +4: flexibilidad sin cambio");
ok(by(body, "f") === undefined, "día +5 (ya fuera de la vuelta gradual): sin cambio");
ok(!body.actions.some((a) => a.workoutId === "past"), "una sesión completada o pasada no se toca");
ok(body.actions.every((a) => a.kind !== "easy" || (a.toMin ?? 999) <= 60), "vuelta gradual nunca más de 60 min");

// De cuello para arriba
const neck = planSituation("sick_neck", today, week, ftp);
const a = by(neck, "a");
ok(a?.kind === "easy" && a.newKey === "z2" && (a.toMin ?? 0) <= 40 && (a.toMin ?? 0) > 0, "hoy: calidad → Z2 de ≤ 40 min");
ok(by(neck, "b")?.kind === undefined, "mañana gym no se toca con cuello (solo se baja intensidad)");
const neck2 = planSituation("sick_neck", "2026-11-13", week, ftp);
ok(by(neck2, "b")?.kind === "rest", "hoy gimnasio → descanso");
ok(by(neck2, "c")?.kind === "easy" && (by(neck2, "c")?.toMin ?? 999) <= 60, "mañana: salida larga con intensidad → Z2 ≤ 60");
for (const x of neck.changes) if (x.newBlocks) ok(calculateTss(x.newBlocks, ftp) <= calculateTss(week.find((w) => w.id === x.workoutId)!.blocks, ftp) + 0.01, `la propuesta ${x.workoutId} no carga más que el original`);
ok(minutesOf(a!.newBlocks!) === a!.toMin, "toMin coincide con los bloques");

// Viaje
const trip = planSituation("travel", today, week, ftp, { from: "2026-11-14", to: "2026-11-16" });
ok(trip.changes.map((x) => x.workoutId).join() === "c,d,e", "viaje 14–16: descansa c, d, e");
ok(trip.changes.every((x) => x.kind === "rest"), "viaje: todo descanso");
const tripNone = planSituation("travel", today, week, ftp, { from: "2026-12-01", to: "2026-12-03" });
ok(tripNone.changes.length === 0, "viaje sin sesiones en esas fechas: sin cambios");
ok(planSituation("travel", today, [], ftp, { from: today, to: today }).changes.length === 0, "sin plan: sin cambios");
ok(neck.evidenceNote.includes("no un umbral validado") && body.evidenceNote.includes("no un umbral validado"), "el texto de evidencia aclara que no es un umbral validado");
// Un Z2 corto no se alarga
const shortZ2 = planSituation("sick_neck", today, [mk("z", today, "z2", 30)], ftp);
ok(shortZ2.changes.length === 0, "un Z2 de 30 min no cambia con síntomas de cuello");
console.log({ problems });
