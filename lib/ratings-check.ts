// npx tsx lib/ratings-check.ts — pruebas de las etiquetas y validaciones de RPE y sensación (sin red ni base de datos)
import { describeRatings, validFeel, validRpe, FEEL_LABELS, RPE_LABELS, expectedRpeBand, ifRatio, readRatings } from "./ratings";

const problems: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };

eq("RPE válidos 1..10", [0, 1, 10, 11, 5.5, NaN].map(validRpe), [false, true, true, false, false, false]);
eq("sensación válida 1..5", [0, 1, 5, 6, 2.5].map(validFeel), [false, true, true, false, false]);
eq("todas las etiquetas de RPE", Object.keys(RPE_LABELS).length, 10);
eq("todas las etiquetas de sensación", Object.keys(FEEL_LABELS).length, 5);
eq("escala de Intervals: 1 = fuerte, 5 = sin fuerzas", [FEEL_LABELS[1], FEEL_LABELS[5]], ["Fuerte", "Sin fuerzas"]);
eq("describe ambos", describeRatings(8, 2), "RPE 8/10 (muy duro), sensación: bien");
eq("describe solo RPE", describeRatings(3, null), "RPE 3/10 (fácil)");
eq("describe solo sensación", describeRatings(null, 5), "sensación: sin fuerzas");
eq("sin datos → null", describeRatings(null, undefined), null);
eq("valores fuera de escala se ignoran", describeRatings(11, 0), null);

// Lectura del RPE contra la carga
eq("IF en porcentaje se pasa a razón", [ifRatio(72.58), ifRatio(0.79), ifRatio(null)], [0.7258, 0.79, null]);
eq("rango esperado IF 0,79", expectedRpeBand(0.79), [4, 6]);
const base = { feel: 2, durationMin: 90, intensityFactor: 0.79, variabilityIndex: 1.46, prior: [] as { rpe: number; feel: number | null; ifr: number | null; label: string }[] };
const r1 = readRatings({ ...base, rpe: 4 });
eq("sRPE = RPE × minutos", r1[0].includes("360 u.a."), true);
eq("RPE 4 con IF 0,79 → dentro", r1.some((l) => l.includes("DENTRO")), true);
eq("VI alto → aviso de sesión variable", r1.some((l) => l.includes("muy variable")), true);
eq("sin 3 sesiones previas → sin tendencia", r1.some((l) => l.includes("menos de 3")), true);
eq("RPE 9 con IF 0,60 → más alto", readRatings({ ...base, rpe: 9, intensityFactor: 0.6, variabilityIndex: 1.05 }).some((l) => l.includes("MÁS ALTO")), true);
const prior = [0.8, 0.78, 0.82].map((f, k) => ({ rpe: 5, feel: 2, ifr: f, label: `s${k}` }));
eq("RPE 8 con IF 0,80 vs previas de 5 → tendencia más alta", readRatings({ ...base, rpe: 8, intensityFactor: 0.8, variabilityIndex: 1.05, prior }).some((l) => l.includes("claramente MÁS ALTO")), true);
eq("RPE 5 con IF 0,80 vs previas de 5 → en línea", readRatings({ ...base, rpe: 5, intensityFactor: 0.8, variabilityIndex: 1.05, prior }).some((l) => l.includes("en línea")), true);
eq("sin datos → sin líneas", readRatings({ ...base, rpe: null, feel: null }), []);

console.log({ problems: problems.length });
if (problems.length) { console.log(problems); process.exit(1); }
