// npx tsx lib/deviation-check.ts — el desacople solo cuenta en sesiones continuas (sin red ni base de datos)
import { detectPlanDeviation } from "./training-engine/deviation";
import { progressionAdjustments } from "./training-engine/autoregulation";

const problems: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };

const base = { tss: 112, plannedTss: 100, decouplingPct: 12 };
eq("continua con desacople alto y +10% → más dura", detectPlanDeviation({ ...base, workoutKey: "z2" }).flag, "HARDER_THAN_PLANNED");
eq("intervalos con desacople alto y +10% → sin desvío", detectPlanDeviation({ ...base, workoutKey: "ronnestad_30_15" }).flag, "NONE");
eq("sin clave → comportamiento anterior", detectPlanDeviation(base).flag, "HARDER_THAN_PLANNED");
eq("+30% de TSS siempre cuenta", detectPlanDeviation({ tss: 130, plannedTss: 100, decouplingPct: null, workoutKey: "hiit_genuino" }).flag, "HARDER_THAN_PLANNED");

const rec = (key: string, at: number, tssRatio: number, deviation: "NONE" | "HARDER_THAN_PLANNED", decouplingPct: number | null) => ({ key, at, tssRatio, deviation, decouplingPct });
const hard = [rec("hiit_genuino", 1, 1.3, "HARDER_THAN_PLANNED", 14), rec("hiit_genuino", 2, 1.3, "HARDER_THAN_PLANNED", 14)];
eq("intervalos más duros con desacople alto no se leen como «costó»", progressionAdjustments(hard)["hiit_genuino"].adjust, 0);
const cont = [rec("z2", 1, 1.0, "HARDER_THAN_PLANNED", 14), rec("z2", 2, 1.0, "HARDER_THAN_PLANNED", 14)];
eq("continuas con desacople alto sí", progressionAdjustments(cont)["z2"].adjust, -1);

console.log({ problems: problems.length });
if (problems.length) { console.log(problems); process.exit(1); }
