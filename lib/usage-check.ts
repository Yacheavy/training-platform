/** Resumen de consumo de IA y medidor de mensajes. Corre con: npx tsx lib/usage-check.ts */
import { summarizeUsage, quotaState, type UsageRow } from "./chat/usage-summary";
let bad = 0, checks = 0;
const ok = (c: boolean, m: string) => { checks++; if (!c) { bad++; console.log("FALLA:", m); } };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const now = new Date("2026-10-10T15:00:00Z"); // 12:00 en Argentina
const at = (iso: string) => new Date(iso);
const row = (athleteId: string, iso: string, cost: number | null, inT = 1000, outT = 200, role = "assistant"): UsageRow => ({ athleteId, role, createdAt: at(iso), inputTokens: cost == null ? null : inT, outputTokens: cost == null ? null : outT, costUsd: cost });
const rows: UsageRow[] = [
  row("a", "2026-10-10T14:00:00Z", 0.02), row("a", "2026-10-10T15:00:00Z", 0.03),
  row("b", "2026-10-10T02:00:00Z", 0.05), // 23:00 del 9 en Argentina: es de ayer
  row("b", "2026-10-04T15:00:00Z", 0.10), row("b", "2026-10-03T15:00:00Z", 0.20), // hace 6 días entra a 7 días; hace 7 no
  row("a", "2026-09-30T15:00:00Z", 0.40), // mes anterior
  row("a", "2026-10-09T15:00:00Z", null), // sin costo registrado
  row("a", "2026-10-10T15:00:00Z", 9, 1, 1, "user"), // mensajes del alumno no cuentan
];
const u = summarizeUsage(rows, now);
ok(near(u.today.costUsd, 0.05) && u.today.messages === 2, `hoy ${u.today.costUsd}/${u.today.messages}`);
ok(near(u.last7.costUsd, 0.02 + 0.03 + 0.05 + 0.10) && u.last7.messages === 4, `7 días ${u.last7.costUsd}`);
ok(near(u.month.costUsd, 0.02 + 0.03 + 0.05 + 0.10 + 0.20) && u.month.messages === 5, `mes ${u.month.costUsd}`);
ok(near(u.total.costUsd, 0.80) && u.total.messages === 6, `total ${u.total.costUsd}`);
ok(u.total.tokens === 6 * 1200, `tokens ${u.total.tokens}`);
ok(u.unmeteredReplies === 1, "sin costo registrado");
ok(u.daily.length === 14 && u.daily[13].dateKey === "2026-10-10" && near(u.daily[13].costUsd, 0.05), "serie diaria");
ok(near(u.daily.find((d) => d.dateKey === "2026-10-09")!.costUsd, 0.05), "el mensaje de las 23:00 locales cuenta en el día anterior");
ok(near(u.monthProjectionUsd!, (0.40 / 10) * 31), `proyección ${u.monthProjectionUsd}`);
ok(u.perStudent[0].athleteId === "b" || u.perStudent[0].athleteId === "a", "orden por alumno");
ok(near(u.perStudent.reduce((s, x) => s + x.month.costUsd, 0), u.month.costUsd), "los alumnos suman el mes");
ok(near(u.perStudent.reduce((s, x) => s + x.total.costUsd, 0), u.total.costUsd), "los alumnos suman el total");
const empty = summarizeUsage([], now);
ok(empty.total.costUsd === 0 && empty.monthProjectionUsd === null && empty.perStudent.length === 0 && empty.daily.length === 14, "sin datos");

for (const [used, limit, left, tone] of [[0, 30, 30, "ok"], [20, 30, 10, "ok"], [25, 30, 5, "low"], [27, 30, 3, "low"], [29, 30, 1, "low"], [30, 30, 0, "out"], [35, 30, 0, "out"], [-2, 30, 30, "ok"]] as const) {
  const q = quotaState(used, limit);
  ok(q.left === left && q.tone === tone && q.pct >= 0 && q.pct <= 100, `quota ${used}/${limit}: ${JSON.stringify(q)}`);
}
console.log({ checks, problems: bad });
process.exit(bad ? 1 : 0);
