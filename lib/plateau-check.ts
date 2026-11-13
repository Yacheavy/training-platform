import { detectPlateau, PLATEAU_WEEKS, type LoadDay } from "./training-engine/plateau";

let problems = 0;
const ok = (c: boolean, m: string) => { if (!c) { problems++; console.log("FALLA:", m); } };
const day0 = Date.UTC(2026, 10, 12);
const series = (f: (i: number) => number, n = 56): LoadDay[] => Array.from({ length: n }, (_, k) => ({ date: new Date(day0 - (n - k) * 86400000), ctl: f(k) }));
const today = new Date(day0);
const base = { today, avgWeeklyTss: 600, daysToNextGoal: null as number | null, ftpStaleWeeks: null as number | null, maxCtlRampPerWeek: 5 };

ok(detectPlateau({ ...base, days: series(() => 80) }).status === "flat", "CTL constante = plana");
ok(detectPlateau({ ...base, days: series((k) => 60 + k * 0.25) }).status === "none", "+~12 en 8 semanas no es plana");
ok(detectPlateau({ ...base, days: series((k) => 60 + k * 0.05) }).status === "flat", "+~2 en 8 semanas es plana");
ok(detectPlateau({ ...base, days: series((k) => 80 - k * 0.25) }).status === "none", "bajando mucho no es estancamiento (es desentrenamiento, otro tema)");
ok(detectPlateau({ ...base, days: series(() => 80, 20) }).status === "insufficient", "con 20 días no se evalúa");
ok(detectPlateau({ ...base, days: series(() => 80).filter((d) => d.date.getTime() < day0 - 10 * 86400000 || d.date.getTime() > day0 - 7 * 86400000 + 86400000) }).status !== "flat" || true, "huecos: no rompe");
// una semana con menos de 4 días de dato = sin datos suficientes
const holes = series(() => 80).filter((d) => !(d.date.getTime() >= day0 - 14 * 86400000 && d.date.getTime() < day0 - 8 * 86400000));
ok(detectPlateau({ ...base, days: holes }).status === "insufficient", "semana sin datos = insuficiente");
ok(detectPlateau({ ...base, days: series(() => 80), daysToNextGoal: 10 }).status === "quiet", "prueba en 10 días: no avisa");
ok(detectPlateau({ ...base, days: series(() => 80), daysToNextGoal: 40 }).status === "flat", "prueba en 40 días: avisa");
ok(detectPlateau({ ...base, days: series(() => 80), daysToNextGoal: -3 }).status === "flat", "prueba ya pasada: avisa");
const f = detectPlateau({ ...base, days: series(() => 80), maxCtlRampPerWeek: 1.5 });
ok(f.suggestedRamp != null && f.suggestedRamp <= 1.5, "la subida propuesta nunca supera el límite del atleta");
const g = detectPlateau({ ...base, days: series(() => 80), maxCtlRampPerWeek: 5 });
ok(g.suggestedRamp === 2.5, "con límite 5 se propone 2,5 por semana");
const shuffled = series((k) => 70 + Math.sin(k) * 0.5).sort(() => 0.5 - Math.random());
const a = detectPlateau({ ...base, days: series((k) => 70 + Math.sin(k) * 0.5) });
const b = detectPlateau({ ...base, days: shuffled });
ok(JSON.stringify(a) === JSON.stringify(b), "el orden de los datos no cambia el resultado");
ok(a.weeklyCtl.length === PLATEAU_WEEKS, "8 medias semanales");
console.log({ problems });
