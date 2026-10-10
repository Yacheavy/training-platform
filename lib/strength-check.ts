/** Invariantes del motor de gimnasio y flexibilidad. Corre con: npx tsx lib/strength-check.ts */
import { buildGymSession, buildFlexSession, chooseRole, buildMobilitySet, gymToText, type GymInput, type GymSession } from "./training-engine/strength";
import { REFERENCES } from "./chat/references";
import { FIGURES, figureSvg } from "./exercise-figures";
import { POOL } from "./training-engine/strength";

let checks = 0;
const problems: string[] = [];
const ok = (c: boolean, m: string) => { checks++; if (!c && problems.length < 40) problems.push(m); };
const refIds = new Set(REFERENCES.map((r) => r.id));

const objectives = ["base", "umbral", "vo2max", "tapering"];
const slots = [20, 30, 40, 45, 60, 75, 90, 120, 150];
let sessions = 0;
let contrastSessions = 0;

for (const objective of objectives)
  for (const cycleLength of [3, 4, 5])
    for (let weekIndex = 0; weekIndex < 12; weekIndex++)
      for (const slotMin of slots)
        for (const gymCountInWeek of [1, 2, 3])
          for (let gymIndexInWeek = 0; gymIndexInWeek < gymCountInWeek; gymIndexInWeek++)
            for (const nextDayHard of [false, true])
              for (const mobilityMin of [0, 8])
               for (const contrast of [undefined, "off", "tradicional", "frances"] as const)
                for (const [isDeload, isTaperWeek] of [[false, false], [true, false], [false, true]] as const) {
                  const i: GymInput = { slotMin, objective, weekIndex, cycleLength, isDeload, isTaperWeek, gymIndexInWeek, gymCountInWeek, nextDayHard, mobilityMin, contrast };
                  const g = buildGymSession(i);
                  sessions++;
                  const tag = `${contrast ?? "-"} ${objective} c${cycleLength} s${weekIndex} ${slotMin}min g${gymIndexInWeek}/${gymCountInWeek} ${isDeload ? "deload" : isTaperWeek ? "taper" : "carga"} next=${nextDayHard}`;
                  const heavy = g.exercises.filter((e) => e.category === "fuerza" && e.restSec >= 150 && !e.group);
                  // contraste: apagado = sin superseries; encendido = solo en la sesión de potencia de umbral/VO2max, nunca en descarga, puesta a punto ni semana 1
                  const grouped = g.exercises.filter((e) => e.group);
                  if (contrast !== "tradicional" && contrast !== "frances") ok(grouped.length === 0, `${tag}: superseries con el contraste apagado`);
                  const off = buildGymSession({ ...i, contrast: undefined });
                  const sinAviso = { ...g, notes: g.notes.filter((n) => !/el contraste empieza/.test(n)) };
                  if (grouped.length === 0) ok(JSON.stringify(off) === JSON.stringify(sinAviso), `${tag}: el ajuste de contraste cambió una sesión sin superseries`);
                  if (grouped.length) {
                    ok(g.role === "potencia" && (objective === "umbral" || objective === "vo2max") && !isDeload && !isTaperWeek && weekIndex > 0, `${tag}: contraste fuera de lugar (${g.role})`);
                    ok(g.title.includes(contrast === "frances" ? "francés" : "tradicional"), `${tag}: título no coincide con el modo`);
                    const ids = [...new Set(grouped.map((e) => e.group!.id))];
                    for (const gid of ids) {
                      const items = grouped.filter((e) => e.group!.id === gid);
                      ok(items.every((e, n) => e.group!.step === n + 1 && e.group!.steps === items.length), `${tag}: pasos de la superserie ${gid} desordenados`);
                      ok(items.length === (contrast === "frances" ? 4 : 2), `${tag}: superserie ${gid} con ${items.length} ejercicios`);
                      ok(items.every((e) => e.sets === items[0].sets) && items[0].sets >= 2 && items[0].sets <= 4, `${tag}: rondas ${items[0].sets} fuera de 2-4 o desiguales`);
                      ok(items[0].category === "fuerza" && items.slice(1).every((e) => e.category === "potencia"), `${tag}: la superserie ${gid} no es pesado + explosivo`);
                      ok(items.slice(0, -1).every((e) => e.restSec === 20) && items[items.length - 1].restSec >= 180, `${tag}: pausas de la superserie ${gid}`);
                    }
                    ok(g.refs.includes("R64") && g.refs.includes("R65") && (contrast !== "frances" || g.refs.includes("R62")), `${tag}: contraste sin sus fuentes`);
                    ok(/No encontré estudios en ciclistas/.test(g.evidence.join(" ")), `${tag}: contraste sin la aclaración de evidencia`);
                    contrastSessions++;
                  }
                  // contenido mínimo
                  ok(g.exercises.length > 0, `${tag}: sin ejercicios`);
                  ok(g.exercises.some((e) => e.category === "core"), `${tag}: sin core`);
                  if (g.role === "fuerza" || g.role === "mantenimiento") ok(heavy.length > 0 || slotMin < 30, `${tag}: rol ${g.role} sin fuerza pesada`);
                  // tiempo
                  const min = g.durationSec / 60;
                  ok(min <= slotMin * 1.2 + 4, `${tag}: dura ${Math.round(min)} min para un slot de ${slotMin}`);
                  ok(min >= 10, `${tag}: dura solo ${Math.round(min)} min`);
                  // potencia: solo en fases de intensidad, nunca en descarga ni puesta a punto, con pocos contactos
                  const power = g.exercises.filter((e) => e.category === "potencia");
                  if (power.length) {
                    ok(objective === "umbral" || objective === "vo2max", `${tag}: potencia fuera de la fase de intensidad`);
                    ok(!isDeload && !isTaperWeek, `${tag}: potencia en descarga o puesta a punto`);
                    const contacts = power.reduce((s, e) => s + e.sets * (parseInt(e.reps, 10) || 0) * (e.reps.includes("por lado") ? 2 : 1), 0);
                    ok(contacts <= 60, `${tag}: ${contacts} contactos de potencia`);
                  }
                  // carga pesada: series, descanso y RIR
                  for (const e of heavy) {
                    ok(e.sets >= 1 && e.sets <= 3, `${tag}: ${e.name} con ${e.sets} series`);
                    const rir = Number(/RIR (\d)/.exec(e.load)?.[1]);
                    ok(Number.isFinite(rir) && rir >= 1 && rir <= 4, `${tag}: RIR inválido en ${e.name}`);
                    if (isDeload) ok(rir >= 4 || nextDayHard, `${tag}: descarga con RIR ${rir}`);
                    if (nextDayHard) ok(rir >= 3, `${tag}: día previo a calidad con RIR ${rir}`);
                    if (weekIndex === 0) ok(e.sets <= 2 && rir >= 4, `${tag}: primera semana sin reentrada`);
                  }
                  // flexibilidad y evidencia
                  ok((g.mobility.length > 0) === (mobilityMin > 0), `${tag}: flexibilidad ${g.mobility.length} ítems con mobilityMin=${mobilityMin}`);
                  ok(g.refs.every((r) => refIds.has(r)), `${tag}: cita inexistente ${g.refs.join(",")}`);
                  if (g.exercises.some((e) => e.category === "fuerza")) ok(g.refs.includes("R57"), `${tag}: fuerza sin R57`);
                  if (g.exercises.some((e) => e.category === "potencia")) ok(g.evidence.some((t) => /LIMITADA/.test(t)), `${tag}: potencia sin la etiqueta de evidencia limitada`);
                  ok(g.evidence.length > 0 && g.notes.length > 0 && g.warmup.length > 0, `${tag}: faltan evidencia, notas o entrada en calor`);
                  // determinismo
                  ok(JSON.stringify(buildGymSession(i)) === JSON.stringify(g), `${tag}: no es determinista`);
                  const txt = gymToText(g);
                  ok(txt.includes(g.title) && g.exercises.every((e) => txt.includes(e.name)), `${tag}: el texto para Intervals omite algo`);
                  ok(!/undefined|NaN|\[object/.test(txt), `${tag}: texto con valores inválidos`);
                }

// roles por fase
const base = (o: Partial<GymInput>): GymInput => ({ slotMin: 90, objective: "base", weekIndex: 1, cycleLength: 4, isDeload: false, isTaperWeek: false, gymIndexInWeek: 0, gymCountInWeek: 2, nextDayHard: false, mobilityMin: 0, ...o });
ok(chooseRole(base({})) === "fuerza" && chooseRole(base({ gymIndexInWeek: 1 })) === "fuerza", "base: dos sesiones de fuerza");
ok(chooseRole(base({ objective: "vo2max" })) === "mantenimiento" && chooseRole(base({ objective: "vo2max", gymIndexInWeek: 1 })) === "potencia", "vo2max: mantenimiento + potencia");
ok(chooseRole(base({ objective: "umbral", isDeload: true, gymIndexInWeek: 1 })) === "estabilidad", "descarga: segunda sesión liviana");

// progresión: mismos ejercicios dentro del mesociclo, distintos al cambiar de mesociclo; más series y menos RIR a medida que avanza
const wk = (w: number) => buildGymSession(base({ weekIndex: w }));
const names = (g: GymSession) => g.exercises.filter((e) => e.restSec >= 150).map((e) => e.id).join(",");
ok(names(wk(1)) === names(wk(2)) && names(wk(2)) === names(wk(3)), "cambian los ejercicios pesados dentro del mesociclo");
ok(names(wk(1)) !== names(wk(5)), "no hay rotación de ejercicios entre mesociclos");
const rirOf = (g: GymSession) => Number(/RIR (\d)/.exec(g.exercises.find((e) => e.restSec >= 150)!.load)![1]);
ok(rirOf(wk(1)) >= rirOf(wk(2)) && rirOf(wk(2)) >= rirOf(wk(3)), "el RIR no baja a medida que avanza el mesociclo");

// flexibilidad como día propio
for (const m of [10, 15, 20, 30, 45]) {
  const f = buildFlexSession(m);
  ok(f.role === "movilidad" && f.mobility.length >= 4 && f.exercises.length === 0, `flex ${m} min: contenido`);
  ok(f.durationSec / 60 <= 30 && f.durationSec / 60 >= 10, `flex ${m} min: dura ${f.durationSec / 60}`);
  ok(f.refs.includes("R58") && f.refs.includes("R59"), "flex sin fuentes");
  ok(/no previene lesiones/i.test(f.evidence.join(" ")), "flex sin el aviso de evidencia");
}
ok(buildMobilitySet(8).length >= 3 && buildMobilitySet(0).length === 0, "set de movilidad de 8 min");

// figuras de los ejercicios
const catalog = new Set(Object.values(POOL).flat().map((e) => e.id));
for (const [id, def] of Object.entries(FIGURES)) {
  ok(catalog.has(id), `figura de un ejercicio que no existe: ${id}`);
  const svg = figureSvg(def, id);
  ok(!/NaN|undefined|Infinity/.test(svg), `figura ${id}: valores inválidos`);
  ok(def.frames.length >= 1 && def.frames.length <= 2, `figura ${id}: cantidad de cuadros`);
  ok(def.labels === undefined || def.labels.length === def.frames.length, `figura ${id}: etiquetas`);
  ok(svg.startsWith("<svg") && svg.endsWith("</svg>"), `figura ${id}: SVG incompleto`);
}
const sinFigura = [...catalog].filter((id) => !FIGURES[id]);
console.log("ejercicios sin figura:", sinFigura.join(", ") || "ninguno");

ok(contrastSessions > 1000, `pocas sesiones de contraste generadas: ${contrastSessions}`);
console.log(JSON.stringify({ sessions, contrastSessions, checks, problems: problems.length }));
if (problems.length) console.log(problems.join("\n"));
process.exit(problems.length ? 1 : 0);
