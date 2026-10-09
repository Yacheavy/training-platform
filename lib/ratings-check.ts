// npx tsx lib/ratings-check.ts — pruebas de las etiquetas y validaciones de RPE y sensación (sin red ni base de datos)
import { describeRatings, validFeel, validRpe, FEEL_LABELS, RPE_LABELS } from "./ratings";

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

console.log({ problems: problems.length });
if (problems.length) { console.log(problems); process.exit(1); }
