/**
 * Resumen del consumo de la IA (tokens y dinero estimado) a partir de las respuestas del asistente.
 * Puro: no toca la base. Los días son del calendario del atleta (zona horaria de la app).
 */
import { dateKeyLocal } from "../tz";

export interface UsageRow {
  athleteId: string;
  role: string;
  createdAt: Date;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export interface UsageTotals { messages: number; tokens: number; costUsd: number }
export interface StudentUsage { athleteId: string; today: UsageTotals; month: UsageTotals; total: UsageTotals }
export interface UsageOverview {
  today: UsageTotals;
  last7: UsageTotals;
  month: UsageTotals;
  total: UsageTotals;
  /** Proyección a fin de mes con el ritmo del mes en curso (null si todavía no hay datos del mes). */
  monthProjectionUsd: number | null;
  /** Costo por día, de más viejo a más nuevo (14 días hasta hoy). */
  daily: { dateKey: string; costUsd: number; messages: number }[];
  perStudent: StudentUsage[];
  /** Respuestas del asistente sin uso registrado (anteriores al contador): no suman ni tokens ni dinero. */
  unmeteredReplies: number;
}

const zero = (): UsageTotals => ({ messages: 0, tokens: 0, costUsd: 0 });
const add = (t: UsageTotals, r: UsageRow) => { t.messages += 1; t.tokens += (r.inputTokens ?? 0) + (r.outputTokens ?? 0); t.costUsd += r.costUsd ?? 0; };
const keyMs = (k: string) => Date.parse(`${k}T00:00:00Z`);
const DAY = 86400000;

export function summarizeUsage(rows: UsageRow[], now: Date): UsageOverview {
  const todayKey = dateKeyLocal(now);
  const monthPrefix = todayKey.slice(0, 7);
  const today = zero(), last7 = zero(), month = zero(), total = zero();
  const perMap = new Map<string, StudentUsage>();
  const dailyMap = new Map<string, { costUsd: number; messages: number }>();
  let unmetered = 0;

  for (const r of rows) {
    if (r.role !== "assistant") continue;
    if (r.costUsd == null) { unmetered++; continue; }
    const k = dateKeyLocal(r.createdAt);
    const ageDays = Math.round((keyMs(todayKey) - keyMs(k)) / DAY);
    add(total, r);
    const s = perMap.get(r.athleteId) ?? { athleteId: r.athleteId, today: zero(), month: zero(), total: zero() };
    add(s.total, r);
    if (k === todayKey) { add(today, r); add(s.today, r); }
    if (ageDays >= 0 && ageDays < 7) add(last7, r);
    if (k.startsWith(monthPrefix)) { add(month, r); add(s.month, r); }
    perMap.set(r.athleteId, s);
    const d = dailyMap.get(k) ?? { costUsd: 0, messages: 0 };
    d.costUsd += r.costUsd; d.messages += 1;
    dailyMap.set(k, d);
  }

  const daily: UsageOverview["daily"] = [];
  for (let i = 13; i >= 0; i--) {
    const k = new Date(keyMs(todayKey) - i * DAY).toISOString().slice(0, 10);
    const d = dailyMap.get(k);
    daily.push({ dateKey: k, costUsd: d?.costUsd ?? 0, messages: d?.messages ?? 0 });
  }

  const [y, m, dayOfMonth] = todayKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthProjectionUsd = month.messages > 0 ? (month.costUsd / dayOfMonth) * daysInMonth : null;

  const perStudent = [...perMap.values()].sort((a, b) => b.month.costUsd - a.month.costUsd || b.total.costUsd - a.total.costUsd);
  return { today, last7, month, total, monthProjectionUsd, daily, perStudent, unmeteredReplies: unmetered };
}

/** Estado del medidor de mensajes del alumno. */
export function quotaState(used: number, limit: number): { used: number; left: number; pct: number; tone: "ok" | "low" | "out" } {
  const u = Math.max(0, Math.min(used, limit));
  const left = Math.max(0, limit - u);
  return { used: u, left, pct: limit > 0 ? Math.round((u / limit) * 100) : 100, tone: left === 0 ? "out" : left <= Math.max(3, Math.ceil(limit * 0.2)) ? "low" : "ok" };
}
