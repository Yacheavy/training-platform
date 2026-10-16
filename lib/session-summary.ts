/**
 * Ordena el fundamento de una sesión (un texto largo con partes separadas por « · ») para mostrarlo claro:
 *  - contexto: bloque y semana
 *  - porQue: la razón de que hoy toque esta sesión
 *  - cambios: lo que pasó con la sesión (rodillo, ajuste por el estado, semana de descarga, carrera cerca…)
 *  - evidencia: nivel de evidencia de la variante (si figura)
 *  - detalle: el resto (rotación de variantes, descripción del protocolo), plegado
 * Función pura: no toca la base.
 */
export interface Change { text: string; warn: boolean }
export interface SessionSummary {
  context: string | null;
  why: string | null;
  changes: Change[];
  evidence: string | null;
  detail: string[];
}

/** Duración corta para tarjetas angostas: «1 h 20 m», «45 m». */
export function fmtShort(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} m` : `${m} m`;
}

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

const REASONS: [RegExp, string][] = [
  [/estímulo principal del objetivo/i, "es el estímulo principal de tu objetivo"],
  [/segundo estímulo\s*[—-]\s*≥\s*(\d+)\s*h del principal/i, "es el segundo estímulo de la semana, $1 h o más después del principal"],
];

export function summarizeRationale(rationale: string | null | undefined, labelOf: (key: string) => string): SessionSummary {
  const out: SessionSummary = { context: null, why: null, changes: [], evidence: null, detail: [] };
  let indoorTip: string | null = null;
  const parts = (rationale ?? "").split(" · ").map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    let m: RegExpMatchArray | null;
    if (/^\[CHECKIN:[A-Z]+:[a-zé]+\]$/i.test(p)) continue; // marca interna
    if ((m = p.match(/^Plan del bloque "(.*?)"\s*—\s*semana (\d+) del (?:bloque|mesociclo)(?: \((.*)\))?$/))) {
      const name = m[1].split(" — ")[0];
      out.context = `${name} · semana ${m[2]}`;
      if (m[3] && /DELOAD/.test(m[3])) {
        const pct = m[3].match(/-(\d+)%/);
        out.changes.push({ text: `Semana de descarga${pct ? ` (${pct[1]} % menos de volumen)` : ""}`, warn: false });
      }
      continue;
    }
    if ((m = p.match(/^(Día de calidad|Salida larga|Día de volumen|Rodaje) → (\S+)(?: \((.*)\))?$/))) {
      const kind = m[1] === "Día de calidad" ? "Día de calidad" : m[1];
      let reason = "";
      for (const [re, txt] of REASONS) if (m[3] && re.test(m[3])) reason = m[3].replace(re, txt);
      out.why = `${kind}: ${labelOf(m[2])}${reason ? ` — ${reason}` : ""}`;
      continue;
    }
    if ((m = p.match(/^Día de (gimnasio|flexibilidad) → (.*)$/))) {
      out.why = `Día de ${m[1]}: ${m[2]}`;
      continue;
    }
    if ((m = p.match(/^evidencia: (.*)$/))) { out.evidence = m[1]; continue; }
    if (/^Rodillo: /.test(p)) { indoorTip = "En rodillo: ventilador fuerte, hidratación y guiate por la potencia (la FC sube más adentro)"; continue; }
    if ((m = p.match(/^se acortó (\d+) min para entrar en el tope de (\d+) min en rodillo(?: \((.*)\))?$/))) {
      out.changes.push({ text: `Acortada ${m[1]} min para entrar en ${fmtMinutes(Number(m[2]))}${m[3] ? ` (${m[3]})` : ""}`, warn: false });
      continue;
    }
    if ((m = p.match(/^los intervalos largos se acortaron (\d+) min en total/))) {
      out.changes.push({ text: `Intervalos largos acortados ${m[1]} min en total (misma potencia)`, warn: false });
      continue;
    }
    if (/^no se pudo bajar de/.test(p)) { out.changes.push({ text: p.charAt(0).toUpperCase() + p.slice(1), warn: true }); continue; }
    if ((m = p.match(/^Ajustada por tu estado de hoy \((.*?)\): (.*)$/))) {
      out.changes.push({ text: `Ajustada por tu estado de hoy: ${m[2]}`, warn: true });
      out.detail.push(`Motivo del ajuste: ${m[1]}`);
      continue;
    }
    if (/^esta variante pierde parte de su sentido en rodillo/.test(p)) { out.changes.push({ text: "Esta variante pierde parte de su sentido en rodillo; si podés, hacela en ruta otro día", warn: true }); continue; }
    if (/^Armado por tu coach$/.test(p)) { out.changes.push({ text: "Armada por tu coach", warn: false }); continue; }
    if ((m = p.match(/^MINI-TAPER pre-carrera \((.*?)\): (.*?)\.(?: (Criterio.*))?$/))) {
      out.changes.push({ text: `Puesta a punto corta (${m[1]}): ${m[2]}`, warn: false });
      if (m[3]) out.detail.push(m[3]);
      continue;
    }
    if (/^A \d+ días de la carrera no hay calidad/.test(p)) { out.changes.push({ text: p.replace(/\s*\(.*\)$/, ""), warn: false }); continue; }
    if ((m = p.match(/^Semana intensificada \(.*?\): (.*)$/))) {
      out.changes.push({ text: `Semana intensificada: ${m[1]}`, warn: false });
      continue;
    }
    if ((m = p.match(/^Variante: (.*?) \((rotación|única opción disponible)(?:; (.*))?\)$/))) {
      out.detail.push(`Variante: ${m[1]} — ${m[2] === "rotación" ? "elegida por rotación" : "única opción disponible"}${m[3] ? ` (${m[3]})` : ""}`);
      continue;
    }
    if (/⚠|Ya alcanzaste|bajando/.test(p)) { out.changes.push({ text: p, warn: true }); continue; }
    out.detail.push(p);
  }
  if (indoorTip) out.changes.push({ text: indoorTip, warn: false });
  return out;
}
