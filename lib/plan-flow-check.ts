/**
 * Prueba de punta a punta del flujo de planes sobre una base en memoria:
 * temporada → generar → regenerar (dos veces) → regenerar una sesión, con alumnos de perfiles distintos.
 * Corre con: npx tsx lib/plan-flow-check.ts   (no toca ninguna base real)
 */
process.env.DATABASE_URL ||= "postgresql://x:x@localhost:5432/x";
import { applySeasonCore } from "./season-apply";
import { generateFullPlan, type PlanDb } from "./training-engine/generate-full-plan";
import { regenerateBlocks } from "./training-engine/regenerate";
import { isOffBike } from "./training-engine/off-bike";
import { dayStartLocal, dateKeyLocal } from "./tz";

// ───────────────────────── base en memoria ─────────────────────────
type Row = Record<string, any>;
let seq = 0;
const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([k, cond]) => {
    const v = row[k];
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (cond && typeof cond === "object") {
      const t = (x: any) => (x instanceof Date ? x.getTime() : x);
      if ("in" in cond && !cond.in.includes(v)) return false;
      if ("not" in cond && (cond.not === null ? v == null : t(v) === t(cond.not))) return false;
      if ("gte" in cond && !(t(v) >= t(cond.gte))) return false;
      if ("gt" in cond && !(t(v) > t(cond.gt))) return false;
      if ("lte" in cond && !(t(v) <= t(cond.lte))) return false;
      if ("lt" in cond && !(t(v) < t(cond.lt))) return false;
      return true;
    }
    return v === cond;
  });
function model(rows: Row[], defaults: () => Row = () => ({})) {
  const sortBy = (o?: Row) => (a: Row, b: Row) => {
    if (!o) return 0;
    const [[k, dir]] = Object.entries(o);
    const av = a[k] instanceof Date ? a[k].getTime() : a[k], bv = b[k] instanceof Date ? b[k].getTime() : b[k];
    return (av - bv) * (dir === "desc" ? -1 : 1);
  };
  return {
    rows,
    findMany: async (a: Row = {}) => rows.filter((r) => matches(r, a.where)).sort(sortBy(a.orderBy)).map((r) => ({ ...r })),
    findFirst: async (a: Row = {}) => { const r = rows.filter((x) => matches(x, a.where)).sort(sortBy(a.orderBy))[0]; return r ? { ...r } : null; },
    findUnique: async (a: Row) => { const r = rows.find((x) => matches(x, a.where)); return r ? { ...r } : null; },
    count: async (a: Row = {}) => rows.filter((r) => matches(r, a.where)).length,
    create: async (a: Row) => { const r = { id: `id${++seq}`, createdAt: new Date(), ...defaults(), ...a.data }; rows.push(r); return { ...r }; },
    update: async (a: Row) => { const r = rows.find((x) => matches(x, a.where)); if (!r) throw new Error("update: no existe"); Object.assign(r, a.data); return { ...r }; },
    deleteMany: async (a: Row = {}) => { let n = 0; for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], a.where)) { rows.splice(i, 1); n++; } return { count: n }; },
  };
}
const LIB: [string, number | null, number | null, number | null][] = [
  ["z2", 56, 75, null], ["sweet_spot", 88, 94, null], ["umbral", 95, 105, 2], ["hiit_genuino", 108, 115, 1], ["billat_30_30", 110, 116, null],
  ["rst", 150, 180, null], ["gym", null, null, null], ["ronnestad_30_15", 125, 135, null], ["z2_progressive", 56, 75, null], ["endurance_tempo", 78, 86, 2],
  ["over_under", 92, 106, 1], ["vo2_long", 108, 115, 1], ["sprint_neuro", null, null, 1], ["long_durability", 84, 90, 1], ["torque_low_cadence", 70, 76, 1], ["z2_sprints", null, null, 1],
];
function makeDb() {
  const m = {
    user: model([]), athleteThresholds: model([]), trainingTemplateSlot: model([]), trainingBlock: model([]), generatedWorkout: model([], () => ({ environment: "road", sentToIntervalsAt: null })),
    activity: model([]), athleteGoal: model([]),
    workoutLibraryEntry: model(LIB.map(([key, lo, hi, mx]) => ({ key, intensityPctFtpLow: lo, intensityPctFtpHigh: hi, maxSessionsPerWeek: mx }))),
  };
  return m as unknown as PlanDb & typeof m;
}

// ───────────────────────── perfiles ─────────────────────────
const contrastSeen = new Set<string>();
const NOW = new Date("2026-10-09T15:00:00Z");
const DAYMS = 86400000;
type Slot = [dow: number, type: string, min: number, quality: boolean];
const FULL: Slot[] = [[0, "cycling", 240, false], [1, "rest", 60, false], [2, "cycling", 120, true], [3, "gym", 90, false], [4, "cycling", 120, true], [5, "gym", 90, false], [6, "cycling", 180, false]];
interface Profile { id: string; ftp: number | null; pvo2?: number | null; template: Slot[]; thresholds?: Row | null; goal?: { type: "EVENT" | "PERFORMANCE"; inDays: number } | null; manualWeeks?: number; expect?: "error" | "empty" }
const PROFILES: Profile[] = [
  { id: "coach-12sem-evento", ftp: 300, pvo2: 370, template: FULL, thresholds: { deloadRatio: "4:1", weeksBetweenFtpTest: 6, ftpTestProtocol: "20min", vo2Stimulus: "ronnestad_30_15", varietyLevel: "balanced", bannedStimuli: ["torque_low_cadence"], periodization: "linear" }, goal: { type: "EVENT", inDays: 84 } },
  { id: "gym-y-flexibilidad", ftp: 270, pvo2: 340, template: [[0, "cycling", 240, false], [1, "flexibility", 20, false], [2, "cycling", 90, true], [3, "gym", 75, false], [4, "cycling", 90, true], [5, "gym", 60, false], [6, "cycling", 150, false]], thresholds: { deloadRatio: "3:1", weeksBetweenFtpTest: 6, flexibilityEnabled: true, periodization: "linear" }, goal: { type: "EVENT", inDays: 70 } },
  { id: "contraste-frances", ftp: 290, pvo2: 360, template: FULL, thresholds: { deloadRatio: "4:1", weeksBetweenFtpTest: 6, contrastMode: "frances" }, goal: { type: "EVENT", inDays: 120 } },
  { id: "contraste-tradicional", ftp: 290, pvo2: 360, template: FULL, thresholds: { deloadRatio: "3:1", weeksBetweenFtpTest: 6, contrastMode: "tradicional", flexibilityEnabled: true }, goal: { type: "EVENT", inDays: 120 } },
  { id: "sin-vo2max-rendimiento", ftp: 280, pvo2: null, template: FULL, thresholds: null, goal: { type: "PERFORMANCE", inDays: 70 } },
  { id: "3-dias-30-semanas", ftp: 180, pvo2: 230, template: [[0, "cycling", 150, false], [2, "cycling", 75, true], [4, "cycling", 60, true]], thresholds: { deloadRatio: "3:1", weeksBetweenFtpTest: 8, ftpTestProtocol: "8min", vo2Stimulus: "hiit_genuino", varietyLevel: "high", bannedStimuli: [], periodization: "block" }, goal: { type: "EVENT", inDays: 210 } },
  { id: "calidad-consecutiva", ftp: 250, pvo2: 320, template: [[0, "cycling", 200, false], [1, "rest", 60, false], [2, "cycling", 90, true], [3, "cycling", 90, true], [4, "rest", 60, false], [5, "cycling", 60, false], [6, "cycling", 150, false]], thresholds: { deloadRatio: "2:1", weeksBetweenFtpTest: 5, ftpTestProtocol: "5min", vo2Stimulus: "billat_30_30", varietyLevel: "low", bannedStimuli: ["sprint_neuro", "z2_sprints"], periodization: "linear" }, goal: { type: "EVENT", inDays: 45 } },
  { id: "objetivo-en-20-dias", ftp: 260, pvo2: 330, template: FULL, thresholds: null, goal: { type: "EVENT", inDays: 20 } },
  { id: "sin-objetivo-bloque-manual", ftp: 220, pvo2: 280, template: FULL, thresholds: { deloadRatio: "4:1", weeksBetweenFtpTest: 4, periodization: "block" }, goal: null, manualWeeks: 6 },
  { id: "sin-plantilla", ftp: 250, pvo2: 300, template: [], thresholds: null, goal: { type: "EVENT", inDays: 84 }, expect: "error" },
  { id: "sin-ftp", ftp: null, template: FULL, thresholds: null, goal: { type: "EVENT", inDays: 84 }, expect: "error" },
];

// ───────────────────────── helpers ─────────────────────────
const HIGH = new Set(["ronnestad_30_15", "hiit_genuino", "billat_30_30", "vo2_long", "rst", "umbral", "over_under", "ftp_test", "ftp_test_8min", "ftp_test_5min"]);
let failures = 0, checks = 0;
const log: string[] = [];
function ok(cond: boolean, msg: string) { checks++; if (!cond) { failures++; log.push("  ✗ " + msg); } }
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
const dow = (d: Date) => new Date(keyOf(d) + "T00:00:00Z").getUTCDay();
const snap = (db: ReturnType<typeof makeDb>, a: string) => db.generatedWorkout.rows.filter((r) => r.athleteId === a).map((r) => ({ ...r })).sort((x, y) => x.date - y.date);

function invariants(db: ReturnType<typeof makeDb>, p: Profile, tag: string) {
  const sessions = snap(db, p.id);
  const byDate = new Map<string, Row[]>();
  for (const s of sessions) byDate.set(keyOf(s.date), [...(byDate.get(keyOf(s.date)) ?? []), s]);
  const blocks = db.trainingBlock.rows.filter((b) => b.athleteId === p.id).sort((a, b) => a.startDate - b.startDate);
  for (const [k, v] of byDate) ok(v.length === 1, `${tag}: ${k} tiene ${v.length} sesiones`);
  // bloques contiguos
  for (let i = 1; i < blocks.length; i++) ok(dateKeyLocal(blocks[i].startDate) === dateKeyLocal(blocks[i - 1].endDate), `${tag}: hueco o solape entre bloques ${i - 1} y ${i}`);
  // cobertura por plantilla
  const slot = new Map(p.template.map(([d, t, min, q]) => [d, { t, min, q }]));
  for (const b of blocks) {
    const startMs = new Date(keyOf(b.startDate) + "T00:00:00Z").getTime();
    const endMs = new Date(dateKeyLocal(b.endDate) + "T00:00:00Z").getTime();
    for (let ms = startMs; ms < endMs; ms += DAYMS) {
      const d = new Date(ms), k = keyOf(d), sl = slot.get(d.getUTCDay()), got = byDate.get(k)?.[0];
      if (!sl || sl.t === "rest") { ok(!got, `${tag}: ${k} es descanso y tiene sesión (${got?.workoutLibraryKey})`); continue; }
      ok(!!got, `${tag}: falta sesión el ${k} (${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getUTCDay()]}) del bloque ${b.name}`);
      if (!got) continue;
      if (sl.t === "gym") ok(got.workoutLibraryKey === "gym", `${tag}: ${k} debía ser gimnasio y es ${got.workoutLibraryKey}`);
      else if (sl.t === "flexibility") ok(got.workoutLibraryKey === "flexibility", `${tag}: ${k} debía ser flexibilidad y es ${got.workoutLibraryKey}`);
      else ok(!isOffBike(got.workoutLibraryKey), `${tag}: ${k} debía ser ciclismo y es ${got.workoutLibraryKey}`);
    }
  }
  // contenido de cada sesión
  for (const s of sessions) {
    const bl = s.blocksJson as { durationSec: number; targetWatts: number }[];
    const k = keyOf(s.date);
    ok(Array.isArray(bl) && bl.length > 0, `${tag}: ${k} sin bloques`);
    if (isOffBike(s.workoutLibraryKey)) {
      const gd = (bl as any[]).find((x) => x.gym)?.gym;
      ok(!!gd, `${tag}: ${k} (${s.workoutLibraryKey}) sin detalle de ejercicios`);
      if (gd) {
        ok(s.workoutLibraryKey === "flexibility" ? gd.mobility.length >= 4 : gd.exercises.length >= 3, `${tag}: ${k} con muy pocos ejercicios`);
        if (s.workoutLibraryKey === "gym") ok((gd.mobility.length > 0) === !!p.thresholds?.flexibilityEnabled, `${tag}: ${k} flexibilidad al final no coincide con el ajuste`);
        const grouped = (gd.exercises as { group?: unknown }[]).some((e) => e.group);
        const cm = (p.thresholds as Row | null | undefined)?.contrastMode as string | undefined;
        if (grouped) { ok(cm === "frances" || cm === "tradicional", `${tag}: ${k} tiene superseries con el contraste apagado`); contrastSeen.add(p.id); }
        ok(gd.durationSec / 60 <= (slot.get(dow(s.date))?.min ?? 0) * 1.2 + 4, `${tag}: ${k} gimnasio dura ${Math.round(gd.durationSec / 60)} min`);
      }
      continue;
    }
    ok(bl.every((x) => Number.isFinite(x.durationSec) && x.durationSec > 0 && Number.isFinite(x.targetWatts) && x.targetWatts > 0), `${tag}: ${k} con duración/potencia inválida`);
    ok(Number.isFinite(s.estimatedTss) && s.estimatedTss > 0 && s.estimatedTss < 400, `${tag}: ${k} TSS fuera de rango (${s.estimatedTss})`);
    const slotMin = slot.get(dow(s.date))?.min ?? 0;
    const mins = bl.reduce((a, x) => a + x.durationSec, 0) / 60;
    ok(mins <= slotMin * 1.3 + 10, `${tag}: ${k} dura ${Math.round(mins)} min y el slot es de ${slotMin}`);
    ok(Math.max(...bl.map((x) => x.targetWatts)) <= (p.ftp ?? 0) * 3, `${tag}: ${k} potencia máxima irreal`);
  }
  // calidad en días consecutivos solo si la plantilla lo pide
  for (const s of sessions) {
    const next = byDate.get(keyOf(new Date(s.date.getTime() + DAYMS)))?.[0];
    if (!next || !HIGH.has(s.workoutLibraryKey) || !HIGH.has(next.workoutLibraryKey)) continue;
    const a = slot.get(dow(s.date)), b = slot.get(dow(next.date));
    ok(!!a?.q && !!b?.q, `${tag}: ${keyOf(s.date)} y ${keyOf(next.date)} son dos intensas seguidas y la plantilla no lo pide`);
  }
}

async function run() {
  const db = makeDb();
  const finalSnaps = new Map<string, string>();
  for (const p of PROFILES) {
    log.push(`\n● ${p.id}`);
    db.user.rows.push({ id: p.id, ftp: p.ftp, pvo2maxWatts: p.pvo2 ?? null });
    if (p.thresholds) db.athleteThresholds.rows.push({ id: "t" + p.id, athleteId: p.id, ...p.thresholds });
    for (const [d, t, min, q] of p.template) db.trainingTemplateSlot.rows.push({ id: `s${++seq}`, athleteId: p.id, dayOfWeek: d, stimulusType: t, targetDurationMin: min, appliesInPhases: [], isQualityDay: q });
    if (p.goal) db.athleteGoal.rows.push({ id: "g" + p.id, athleteId: p.id, goalType: p.goal.type, name: "Objetivo", eventDate: new Date(new Date(NOW.getTime() + p.goal.inDays * DAYMS).toISOString().slice(0, 10) + "T00:00:00Z"), priority: "A", metric: null });

    // 1) crear
    let r: any;
    if (p.manualWeeks) {
      const start = dayStartLocal(NOW);
      const b = await db.trainingBlock.create({ data: { athleteId: p.id, name: "Manual", objective: "umbral", startDate: start, endDate: new Date(start.getTime() + p.manualWeeks * 7 * DAYMS), plannedWeeklyTssProgression: [] } });
      const g = await generateFullPlan(b.id, { athleteId: p.id, now: NOW }, db);
      r = { blocks: 1, sessions: g.created, skipped: g.skipped, warnings: g.warnings };
    } else {
      try { r = await applySeasonCore(db, p.id, NOW); } catch (e) { r = { error: "EXCEPCIÓN " + String(e) }; }
    }
    if (p.expect === "error") { ok("error" in r, `${p.id}: debía devolver un error claro y devolvió ${JSON.stringify(r).slice(0, 80)}`); log.push(`  error esperado → "${r.error}"`); ok(snap(db, p.id).length === 0, `${p.id}: no debía crear sesiones`); continue; }
    ok(!("error" in r), `${p.id}: falló al crear: ${r.error}`);
    if ("error" in r) continue;
    log.push(`  temporada: ${r.blocks} bloque(s), ${r.sessions} sesiones, ${r.skipped} omitidas, ${r.warnings.length} advertencias`);
    ok(r.skipped === 0, `${p.id}: ${r.skipped} días omitidos al crear`);
    const hard = r.warnings.filter((w: string) => !w.startsWith("INFO"));
    ok(hard.length === 0, `${p.id}: advertencias del validador: ${hard.slice(0, 3).join(" | ")}`);
    for (const w of r.warnings.filter((w: string) => w.startsWith("INFO"))) log.push("  ℹ " + w);
    if (p.expect === "empty") { ok(r.sessions === 0, `${p.id}: sin plantilla no debía crear sesiones`); log.push(`  sin plantilla → ${r.sessions} sesiones (la app crea los bloques igual)`); continue; }
    ok(r.sessions > 0, `${p.id}: no creó ninguna sesión`);
    const blocks = db.trainingBlock.rows.filter((b) => b.athleteId === p.id).sort((a, b) => a.startDate - b.startDate);
    log.push("  bloques: " + blocks.map((b) => `${b.objective} ${dateKeyLocal(b.startDate)}→${dateKeyLocal(b.endDate)}`).join(" · "));
    if (p.goal && !p.manualWeeks) {
      const goalKey = keyOf(new Date(NOW.getTime() + p.goal.inDays * DAYMS));
      ok(dateKeyLocal(blocks[blocks.length - 1].endDate) <= goalKey, `${p.id}: el último bloque termina después del objetivo (${goalKey})`);
    }
    invariants(db, p, `${p.id}/crear`);

    // 2) marcar sesiones futuras con estados especiales
    const future = snap(db, p.id).filter((s) => s.date.getTime() >= NOW.getTime() + 12 * DAYMS && s.workoutLibraryKey !== "gym");
    const set = (i: number, patch: Row) => { const s = future[i]; if (s) Object.assign(db.generatedWorkout.rows.find((x) => x.id === s.id)!, patch); return s; };
    const completed = set(3, { status: "COMPLETED" }), edited = set(5, { status: "EDITED" }), sent = set(7, { status: "SENT_TO_INTERVALS" }), indoor = set(9, { environment: "indoor" });

    // 3) regenerar desde 10 días adelante
    const t1 = new Date(NOW.getTime() + 10 * DAYMS), from = dayStartLocal(t1);
    const before = snap(db, p.id);
    const reg = await regenerateBlocks(db, p.id, from, t1);
    log.push(`  regenerar (+10 d): ${reg.created} sesiones, ${reg.skipped} omitidas, ${reg.failedBlocks.length} bloques con error`);
    ok(reg.skipped === 0 && reg.failedBlocks.length === 0, `${p.id}: la regeneración omitió días o falló un bloque`);
    const after = snap(db, p.id);
    ok(after.length === before.length, `${p.id}: regenerar cambió la cantidad de sesiones (${before.length} → ${after.length})`);
    for (const b of before.filter((x) => x.date < from)) ok(JSON.stringify(after.find((x) => x.id === b.id)) === JSON.stringify(b), `${p.id}: regenerar tocó una sesión pasada (${keyOf(b.date)})`);
    for (const s of [completed, edited]) if (s) { const a = after.find((x) => x.id === s.id); const b0 = before.find((x) => x.id === s.id)!; ok(!!a && a.status === b0.status && JSON.stringify(a.blocksJson) === JSON.stringify(b0.blocksJson), `${p.id}: regenerar tocó una sesión ${b0.status}`); }
    if (sent) { const a = after.find((x) => x.id === sent.id); ok(a?.status === "APPROVED" && reg.resend.includes(sent.id), `${p.id}: la sesión enviada debía quedar aprobada y marcada para reenviar (quedó ${a?.status})`); }
    if (indoor) { const a = after.find((x) => x.id === indoor.id); ok(a?.environment === "indoor", `${p.id}: el rodillo no se conservó`); }
    invariants(db, p, `${p.id}/regenerar1`);

    // 4) idempotencia
    const a1 = snap(db, p.id).map((s) => `${keyOf(s.date)}:${s.workoutLibraryKey}:${s.status}:${s.environment}`).join("|");
    await regenerateBlocks(db, p.id, from, t1);
    const a2 = snap(db, p.id).map((s) => `${keyOf(s.date)}:${s.workoutLibraryKey}:${s.status}:${s.environment}`).join("|");
    ok(a1 === a2, `${p.id}: regenerar dos veces seguidas da planes distintos`);
    invariants(db, p, `${p.id}/regenerar2`);

    // 5) regenerar desde hoy (cruza el inicio del primer bloque)
    await regenerateBlocks(db, p.id, dayStartLocal(NOW), NOW);
    ok(snap(db, p.id).length === after.length, `${p.id}: regenerar desde hoy cambió la cantidad de sesiones`);
    invariants(db, p, `${p.id}/regenerar-hoy`);

    // 6) regenerar una sola sesión (vuelve a ruta, no toca otras)
    const target = snap(db, p.id).find((s) => s.status === "PLANNED" && s.workoutLibraryKey !== "gym" && s.date.getTime() > t1.getTime());
    if (target) {
      const blk = blocks.find((b) => b.startDate <= target.date && target.date < b.endDate) ?? blocks[blocks.length - 1];
      const others = snap(db, p.id).filter((s) => s.id !== target.id).map((s) => JSON.stringify(s)).join("|");
      await generateFullPlan(blk.id, { athleteId: p.id, replaceDate: target.date, replaceAll: true, now: t1 }, db);
      ok(snap(db, p.id).filter((s) => keyOf(s.date) === keyOf(target.date)).length === 1, `${p.id}: regenerar una sesión duplicó el día`);
      ok(snap(db, p.id).filter((s) => s.id !== target.id).map((s) => JSON.stringify(s)).join("|") === others, `${p.id}: regenerar una sesión tocó otras sesiones`);
    }
    invariants(db, p, `${p.id}/final`);
    finalSnaps.set(p.id, JSON.stringify(snap(db, p.id)));
  }
  // aislamiento: lo que hizo un alumno no tocó a los demás
  for (const [id, s] of finalSnaps) ok(JSON.stringify(snap(db, id)) === s, `${id}: sus sesiones cambiaron por operaciones de otros alumnos`);

  for (const id of ["contraste-frances", "contraste-tradicional"]) ok(contrastSeen.has(id), `${id}: el plan no generó ninguna superserie de contraste`);
  console.log(log.join("\n"));
  console.log(`\n${checks} comprobaciones, ${failures} fallas`);
  process.exit(failures ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(2); });
