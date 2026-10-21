// Prueba del asistente de puesta en marcha con atletas virtuales: base de datos falsa en memoria, sesiones simuladas y plan generado desde cada semana.
// Ejecutar: npx tsx lib/onboarding-check.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "node:path";

const root = path.resolve(__dirname, "..");
type Row = Record<string, any>;
const db = {
  users: new Map<string, Row>(),
  slots: [] as Row[],
  goals: [] as Row[],
  invites: [] as Row[],
};
let currentUser: string | null = null;
const mails: { to: string; subject: string; html: string }[] = [];
let coachId = "coach1";
let revalidated: string[] = [];

const fakePrisma: any = {
  user: {
    findUnique: async ({ where, select }: any) => {
      const u = db.users.get(where.id) ?? [...db.users.values()].find((x) => x.email === where.email);
      if (!u) return null;
      if (!select) return { ...u };
      return Object.fromEntries(Object.keys(select).map((k) => [k, u[k] ?? null]));
    },
    update: async ({ where, data }: any) => { Object.assign(db.users.get(where.id)!, data); return db.users.get(where.id); },
  },
  trainingTemplateSlot: {
    upsert: async ({ where, update, create }: any) => {
      const k = where.athleteId_dayOfWeek;
      const ex = db.slots.find((s) => s.athleteId === k.athleteId && s.dayOfWeek === k.dayOfWeek);
      if (ex) Object.assign(ex, update); else db.slots.push({ ...create });
    },
    findMany: async ({ where }: any) => db.slots.filter((s) => s.athleteId === where.athleteId),
    count: async ({ where }: any) => db.slots.filter((s) => s.athleteId === where.athleteId && (!where.stimulusType || s.stimulusType === where.stimulusType)).length,
  },
  athleteGoal: {
    create: async ({ data }: any) => { const g = { id: `g${db.goals.length + 1}`, ...data }; db.goals.push(g); return g; },
    findFirst: async ({ where }: any) => db.goals.find((g) => g.athleteId === where.athleteId && g.goalType === where.goalType && g.name === where.name && g.eventDate?.getTime() === where.eventDate?.getTime()) ?? null,
  },
  allowedEmail: { findFirst: async ({ where }: any) => db.invites.find((i) => i.email === where.email) ?? null },
  $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
};

const stub = (rel: string, exports: any) => {
  const p = path.join(root, rel);
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] } as any;
};
stub("lib/prisma.ts", { prisma: fakePrisma });
stub("auth.ts", { auth: async () => (currentUser ? { user: { id: currentUser } } : null) });
stub("lib/push-goals.ts", { pushGoalsToIntervals: async () => {}, removeGoalFromIntervals: async () => {} });
stub("lib/access.ts", {
  requireCoachId: async () => { if (currentUser !== coachId) throw new Error("Solo el entrenador puede hacer esto"); return coachId; },
  requireCoachOfStudent: async (id: string) => {
    const inv = db.invites.find((i) => i.email === db.users.get(id)?.email);
    if (!inv || inv.invitedById !== coachId) throw new Error("Alumno no encontrado");
    return db.users.get(id);
  },
});
stub("lib/email/mailer.ts", { mailConfigured: () => true, appUrl: () => "https://app.test", sendMail: async (m: any) => { mails.push(m); } });
const nextCache = require.resolve("next/cache");
require.cache[nextCache] = { id: nextCache, filename: nextCache, loaded: true, exports: { revalidatePath: (p: string) => revalidated.push(p) }, children: [], paths: [] } as any;

const actions = require("./onboarding-actions") as typeof import("./onboarding-actions");
const { buildPlan } = require("./training-engine/plan-builder") as typeof import("./training-engine/plan-builder");
const { validatePlan } = require("./training-engine/plan-validator") as typeof import("./training-engine/plan-validator");
type P = import("./onboarding-actions").OnboardingPayload;

let problems = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { problems++; console.log("FALLA:", msg); } };
const D = (dayOfWeek: number, type: P["days"][number]["type"], min: number, quality = false) => ({ dayOfWeek, type, quality, min: type === "rest" ? "" : String(min) });
const restWeek = () => [1, 2, 3, 4, 5, 6, 0].map((d) => D(d, "rest", 0));
const base = (over: Partial<P> = {}): P => ({ ftp: "", p5: "", weight: "", days: restWeek(), goal: { mode: "general", name: "", date: "", priority: "A", profile: "", metric: "ftp", target: "" }, background: "", injuries: "", preferences: "", ...over });
const addUser = (id: string, name: string, email: string, extra: Row = {}) => { db.users.set(id, { id, name, email, role: "ATHLETE", ftp: null, weight: null, coachId: null, ...extra }); db.invites.push({ email, invitedById: coachId }); };
const as = (id: string | null) => { currentUser = id; };
const run = async (step: number, p: P) => actions.saveOnboardingStep(step, p);
const err = (r: unknown) => (r && typeof r === "object" && "error" in (r as any) ? (r as any).error as string : null);

// Planes de las semanas elegidas (misma entrada que usa la app al generar)
const L = (lo: number | null, hi: number | null, mx: number | null = null) => ({ intensityPctFtpLow: lo, intensityPctFtpHigh: hi, maxSessionsPerWeek: mx });
const library: any = { z2: L(56, 75), sweet_spot: L(88, 94), umbral: L(95, 105, 2), hiit_genuino: L(108, 115, 1), ronnestad_30_15: L(125, 135), z2_sprints: L(null, null), billat_30_30: L(110, 116), rst: L(150, 180), gym: L(null, null), z2_progressive: L(56, 75), endurance_tempo: L(78, 86, 2), over_under: L(92, 106, 1), vo2_long: L(108, 115, 1), sprint_neuro: L(null, null, 1), long_durability: L(84, 90, 1), torque_low_cadence: L(70, 76, 1) };
function planFor(id: string, ftp: number) {
  const tpl = db.slots.filter((s) => s.athleteId === id).map((s) => ({ dayOfWeek: s.dayOfWeek, stimulusType: s.stimulusType, isQualityDay: s.isQualityDay, targetDurationMin: s.targetDurationMin }));
  const start = new Date(Date.UTC(2026, 9, 26, 12, 0, 0));
  const plan = buildPlan({ block: { name: "t", objective: "vo2max", startDate: start, endDate: new Date(start.getTime() + 6 * 7 * 86400000) }, ftp, pvo2maxWatts: null, thresholds: { deloadRatio: "4:1", weeksBetweenFtpTest: 5, varietyLevel: "balanced", bannedStimuli: [], periodization: "linear" }, template: tpl, library });
  return { tpl, plan, warnings: validatePlan(plan, { objective: "vo2max", ftp }).filter((w) => !w.startsWith("INFO")) };
}

(async () => {
  // ── 1. Novato: sin FTP, 3 días de bici, sin objetivo ──────────────────────────────
  db.users.set("coach1", { id: "coach1", name: "Alejandro", email: "coach@test.com", role: "COACH" });
  addUser("u_novato", "Lucía Novato", "lucia@test.com");
  as("u_novato");
  const novato = base({ days: [D(1, "rest", 0), D(2, "cycling", 75, true), D(3, "rest", 0), D(4, "cycling", 60), D(5, "rest", 0), D(6, "cycling", 150), D(0, "rest", 0)] });
  for (const s of [1, 2, 3, 4]) check(err(await run(s, novato)) === null, `novato paso ${s}`);
  check(db.users.get("u_novato")!.ftp === null, "novato: FTP vacío debe quedar sin definir");
  check(db.slots.filter((s) => s.athleteId === "u_novato").length === 7, "novato: se guardan los 7 días");
  check(db.goals.filter((g) => g.athleteId === "u_novato").length === 0, "novato: «mejorar en general» no crea objetivo");
  const r1 = await actions.submitOnboarding();
  check(!err(r1) && !!db.users.get("u_novato")!.onboardingSubmittedAt, "novato: envío");
  check(mails.length === 1 && mails[0].to === "coach@test.com", "novato: mail al coach");

  // ── 2. Competitivo: FTP 280, calidad pegada, objetivo con fecha, nombre con HTML ──────
  addUser("u_comp", "<b>Mar</b> & Co", "comp@test.com");
  as("u_comp");
  const comp = base({
    ftp: "280", weight: "68,5",
    days: [D(1, "gym", 60), D(2, "cycling", 90, true), D(3, "cycling", 60, true), D(4, "rest", 0), D(5, "gym", 45), D(6, "cycling", 240), D(0, "cycling", 120)],
    goal: { mode: "event", name: "Gran Fondo Test", date: "2027-02-14", priority: "A", profile: "fondo", metric: "ftp", target: "" },
    injuries: "Rodilla derecha", preferences: "Sin rodillo los domingos", background: "5 años en ruta",
  });
  for (const s of [1, 2, 3, 4]) check(err(await run(s, comp)) === null, `competitivo paso ${s}: ${err(await run(s, comp))}`);
  const cu = db.users.get("u_comp")!;
  check(cu.ftp === 280 && cu.weight === 68.5, `competitivo: FTP/peso (${cu.ftp}/${cu.weight})`);
  check(cu.currentStateNote === "Rodilla derecha" && cu.preferences === "Sin rodillo los domingos", "competitivo: límites guardados");
  check(db.goals.filter((g) => g.athleteId === "u_comp").length === 1 && db.goals.find((g) => g.athleteId === "u_comp")!.courseProfile === "fondo", "competitivo: objetivo con perfil");
  // Reanudar: repetir el paso 3 no duplica el objetivo
  await run(3, comp); await run(3, comp);
  check(db.goals.filter((g) => g.athleteId === "u_comp").length === 1, "reanudar: el objetivo no se duplica");
  const mailsBefore = mails.length;
  await actions.submitOnboarding();
  const m = mails[mailsBefore];
  check(!!m && !m.html.includes("<b>Mar</b>") && m.html.includes("&lt;b&gt;Mar&lt;/b&gt;"), "el nombre del alumno se escapa en el mail al coach");

  // ── 3. Entradas inválidas ───────────────────────────────────────────────────────────
  addUser("u_bad", "Inválido", "bad@test.com");
  as("u_bad");
  check(!!err(await run(1, base({ ftp: "20" }))), "FTP 20 W se rechaza");
  check(!!err(await run(1, base({ ftp: "900" }))), "FTP 900 W se rechaza");
  check(!!err(await run(1, base({ weight: "500" }))), "peso 500 kg se rechaza");
  check(!!err(await run(1, base({ ftp: "abc" }))), "FTP no numérico se rechaza");
  check(!!err(await run(2, base())), "semana sin ningún día de bici se rechaza");
  check(!!err(await run(2, base({ days: [D(2, "cycling", 10), ...[1, 3, 4, 5, 6, 0].map((d) => D(d, "rest", 0))] }))), "bici de 10 min se rechaza");
  check(!!err(await run(2, base({ days: [D(2, "cycling", 700), ...[1, 3, 4, 5, 6, 0].map((d) => D(d, "rest", 0))] }))), "bici de 700 min se rechaza");
  check(!!err(await run(3, base({ goal: { mode: "event", name: "", date: "2027-01-01", priority: "A", profile: "", metric: "ftp", target: "" } }))), "carrera sin nombre se rechaza");
  check(!!err(await run(3, base({ goal: { mode: "event", name: "X", date: "mañana", priority: "A", profile: "", metric: "ftp", target: "" } }))), "fecha inválida se rechaza");
  check(db.users.get("u_bad")!.ftp === null && db.slots.filter((s) => s.athleteId === "u_bad").length === 0, "lo inválido no guarda nada");
  check(!!err(await actions.submitOnboarding()), "no se puede enviar sin días de bici");
  // Prioridad y perfil raros se normalizan, no rompen
  check(err(await run(3, base({ goal: { mode: "event", name: "Rara", date: "2027-03-01", priority: "Z" as any, profile: "volcan", metric: "ftp", target: "" } }))) === null, "prioridad/perfil desconocidos no rompen");
  const rara = db.goals.find((g) => g.name === "Rara")!;
  check(rara.priority === "B" && (rara.courseProfile ?? null) === null, `normaliza prioridad/perfil (${rara.priority}/${rara.courseProfile})`);
  // Texto largo se recorta
  await run(4, base({ preferences: "x".repeat(5000) }));
  check(db.users.get("u_bad")!.preferences.length === 2000, "texto largo se recorta a 2000");


  // ── 3b. FTP y 5 min traídos de Intervals, pisables a mano ───────────────────────────
  addUser("u_int", "Desde Intervals", "int@test.com", { powerCurveJson: { points: [{ secs: 300, watts: 310 }] } });
  as("u_int");
  await run(1, base({ ftp: "290", p5: "310" }));
  check(db.users.get("u_int")!.ftp === 290 && db.users.get("u_int")!.pvo2maxWatts === 310, "guarda FTP y 5 min");
  check(db.users.get("u_int")!.pvo2maxSource === "intervals-5min", `5 min igual al de Intervals se marca «desde Intervals» (${db.users.get("u_int")!.pvo2maxSource})`);
  await run(1, base({ ftp: "290", p5: "325" }));
  check(db.users.get("u_int")!.pvo2maxWatts === 325 && db.users.get("u_int")!.pvo2maxSource === "manual", "5 min pisado a mano se marca manual");
  check(!!err(await run(1, base({ p5: "30" }))) && !!err(await run(1, base({ p5: "2000" }))), "5 min fuera de rango se rechaza");
  check(err(await run(1, base({ ftp: "290", p5: "" }))) === null && db.users.get("u_int")!.pvo2maxWatts === 325, "5 min vacío no borra el valor guardado");

  // ── 3c. Metas de rendimiento ──────────────────────────────────────────────────────
  const perf = (metric: "ftp" | "p5" | "weight", target: string, date = ""): P => base({ ftp: "290", p5: "310", weight: "70", goal: { mode: "performance", name: "", date, priority: "A", profile: "", metric, target } });
  check(err(await run(3, perf("ftp", "300"))) === null, "meta FTP 290→300");
  const g = db.goals.find((x) => x.athleteId === "u_int" && x.goalType === "PERFORMANCE")!;
  check(!!g && g.name === "Subir FTP a 300 W" && g.baselineValue === 290 && g.targetValue === 300 && /ftp/i.test(g.metric) && g.priority === "B", `meta guardada bien (${JSON.stringify(g)})`);
  await run(3, perf("ftp", "300")); await run(3, perf("ftp", "300"));
  check(db.goals.filter((x) => x.athleteId === "u_int" && x.goalType === "PERFORMANCE").length === 1, "meta repetida no se duplica");
  check(!!err(await run(3, perf("ftp", "280"))), "meta de potencia menor o igual a la actual se rechaza");
  check(!!err(await run(3, perf("ftp", "900"))), "meta fuera de rango se rechaza");
  check(!!err(await run(3, perf("ftp", ""))), "meta vacía se rechaza");
  check(err(await run(3, perf("p5", "340", "2027-03-01"))) === null && db.goals.some((x) => x.name === "Subir potencia de 5 min a 340 W" && x.eventDate), "meta de 5 min con fecha");
  check(err(await run(3, perf("weight", "66,5"))) === null && db.goals.some((x) => x.name === "Llegar a 66.5 kg" && x.baselineValue === 70), "meta de peso (baja)");
  check(!!err(await run(3, perf("weight", "70"))), "meta de peso igual al actual se rechaza");
  check(!!err(await run(3, { ...perf("ftp", "300"), ftp: "" })), "meta FTP sin FTP actual pide cargarlo");
  check(db.goals.filter((x) => x.athleteId === "u_int" && x.goalType === "EVENT").length === 0, "las metas de rendimiento no crean carreras");

  // ── 4. Seguridad: un alumno no toca a otro ─────────────────────────────────────────
  addUser("u_a", "A", "a@test.com", { ftp: 200 });
  addUser("u_b", "B", "b@test.com", { ftp: 300 });
  as("u_a");
  await run(1, base({ ftp: "210" }));
  await run(2, base({ days: [D(2, "cycling", 60, true), ...[1, 3, 4, 5, 6, 0].map((d) => D(d, "rest", 0))] }));
  check(db.users.get("u_b")!.ftp === 300 && db.slots.filter((s) => s.athleteId === "u_b").length === 0, "A no modifica a B");
  as(null);
  check(!!err(await run(1, base({ ftp: "250" }))) && !err(await run(1, base())) === false, "sin sesión no se puede guardar");
  check(!!err(await actions.submitOnboarding()), "sin sesión no se puede enviar");

  // ── 5. Revisión del coach ───────────────────────────────────────────────────────────
  as("u_a");
  check(!err(await actions.submitOnboarding()), "A envía");
  check(await actions.markOnboardingReviewed("u_a").then(() => false).catch(() => true) || !!err(await actions.markOnboardingReviewed("u_a")), "un alumno no puede marcar como revisada");
  check(!db.users.get("u_a")!.onboardingReviewedAt, "sigue sin revisar");
  as("coach1");
  check(!err(await actions.markOnboardingReviewed("u_a")) && !!db.users.get("u_a")!.onboardingReviewedAt, "el coach marca revisada");
  db.invites.push({ email: "otro@test.com", invitedById: "otro_coach" }); addUser("u_x", "X", "otro@test.com"); db.invites.pop(); db.invites.push({ email: "otro@test.com", invitedById: "otro_coach" });
  check(!!err(await actions.markOnboardingReviewed("u_x")), "un coach no revisa alumnos de otro coach");
  as("u_a");
  await actions.submitOnboarding();
  check(db.users.get("u_a")!.onboardingReviewedAt === null, "reenviar reinicia la revisión");

  // ── 6. Consistencia: el plan que sale de cada semana respeta lo que se eligió ────────
  for (const [id, ftp] of [["u_novato", 200], ["u_comp", 280]] as const) {
    const { tpl, plan, warnings } = planFor(id, ftp);
    check(plan.length > 0, `${id}: se generó el plan`);
    check(warnings.length === 0, `${id}: plan con advertencias ${warnings.slice(0, 2).join(" | ")}`);
    const rest = new Set(tpl.filter((t) => t.stimulusType === "rest").map((t) => t.dayOfWeek));
    const gym = new Set(tpl.filter((t) => t.stimulusType === "gym").map((t) => t.dayOfWeek));
    for (const d of plan) {
      const dow = d.date.getUTCDay();
      if (rest.has(dow) && d.stimulusType !== "rest") check(false, `${id}: sesión «${d.stimulusType}» en día de descanso ${d.date.toISOString().slice(0, 10)}`);
      if (gym.has(dow) && d.stimulusType !== "gym") check(false, `${id}: día de gimnasio sin gimnasio ${d.date.toISOString().slice(0, 10)}`);
    }
    // Duración: ninguna sesión de bici se pasa del tiempo elegido para ese día
    for (const d of plan.filter((x) => !["rest", "gym", "flexibility"].includes(x.stimulusType))) {
      const t = tpl.find((x) => x.dayOfWeek === d.date.getUTCDay());
      const min = Math.round(d.blocks.reduce((s: number, b: any) => s + b.durationSec, 0) / 60);
      if (t?.targetDurationMin && min > t.targetDurationMin * 1.15 + 5) check(false, `${id}: ${d.date.toISOString().slice(0, 10)} dura ${min} min y elegiste ${t.targetDurationMin}`);
    }
  }
  // Semana tipo de las tres plantillas rápidas del asistente
  const presets: [string, P["days"]][] = [
    ["3 días", [D(1, "rest", 0), D(2, "cycling", 75, true), D(3, "rest", 0), D(4, "cycling", 60), D(5, "rest", 0), D(6, "cycling", 150), D(0, "rest", 0)]],
    ["4 días + gym", [D(1, "gym", 60), D(2, "cycling", 90, true), D(3, "rest", 0), D(4, "cycling", 60), D(5, "gym", 60), D(6, "cycling", 180), D(0, "cycling", 90)]],
    ["5 días", [D(1, "rest", 0), D(2, "cycling", 90, true), D(3, "cycling", 60), D(4, "cycling", 90, true), D(5, "cycling", 60), D(6, "cycling", 180), D(0, "cycling", 120)]],
  ];
  for (const [name, days] of presets) {
    const id = `u_p_${name}`;
    addUser(id, name, `${id}@t.com`);
    as(id);
    check(err(await run(2, base({ days }))) === null, `preset ${name}: guarda`);
    const { warnings, plan } = planFor(id, 250);
    check(plan.length > 0 && warnings.length === 0, `preset ${name}: plan sin advertencias ${warnings.slice(0, 2).join(" | ")}`);
  }

  console.log(problems === 0 ? "Puesta en marcha: todo bien" : `${problems} fallas`);
  process.exit(problems ? 1 : 0);
})();
