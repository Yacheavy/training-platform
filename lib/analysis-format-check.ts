// npx tsx lib/analysis-format-check.ts — pruebas del formato en secciones del análisis (puro, sin red ni base de datos)
import { parseAnalysis } from "./analysis-format";

const problems: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };

const sample = `### Lo que salió bien
Hiciste los **5 sprints** de 30 s: el primero a 695 W.

### Para mirar
- Duración: 90 min contra 120 (−25%).
- Desacople de 12,5%.

Segundo párrafo de la sección.

### Lo que sigue
Hoy toca gimnasio.
Mañana, 180 min de Z2.

Fuentes: Almquist 2021; Thomas 2016`;

const p = parseAnalysis(sample);
if (!p) problems.push("no reconoció las secciones");
else {
  eq("claves", p.sections.map((s) => s.key), ["good", "watch", "next"]);
  eq("títulos", p.sections.map((s) => s.heading), ["Lo que salió bien", "Para mirar", "Lo que sigue"]);
  eq("viñetas de 'Para mirar'", p.sections[1].blocks.map((b) => b.type), ["li", "li", "p"]);
  eq("líneas seguidas se unen en un párrafo", p.sections[2].blocks, [{ type: "p", text: "Hoy toca gimnasio. Mañana, 180 min de Z2." }]);
  eq("fuentes", p.sources, "Almquist 2021; Thomas 2016");
  eq("sin texto antes", p.intro, []);
}
eq("texto sin secciones → null", parseAnalysis("Un párrafo suelto.\n\nOtro párrafo."), null);
eq("título en negrita reconocido", parseAnalysis("**Para mirar**\nAlgo.")?.sections[0].key, "watch");
eq("título desconocido → other", parseAnalysis("### Clima\nNublado.")?.sections[0].key, "other");
eq("sin acentos ni mayúsculas", parseAnalysis("## LO QUE SALIO BIEN\nok")?.sections[0].key, "good");

console.log({ problems: problems.length });
if (problems.length) { console.log(problems); process.exit(1); }
