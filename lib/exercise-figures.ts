/**
 * Figuras de palitos de los ejercicios (SVG generado en código, vista lateral, una o dos posiciones).
 * Cada postura se define con ángulos de los segmentos y se resuelve con cinemática directa: así todas las figuras
 * comparten proporciones y estilo. Son esquemas para ubicar la posición, NO reemplazan la corrección técnica de un
 * profesional ni un video.
 *
 * Convención de ángulos (grados, mirando a la derecha): 0 = hacia abajo, 90 = hacia adelante, 180 = hacia arriba,
 * -90 = hacia atrás. Para el torso el ángulo apunta de la cadera al hombro (180 = erguido, 150 = inclinado adelante).
 */

type P = { x: number; y: number };
const dir = (a: number): P => ({ x: Math.sin((a * Math.PI) / 180), y: Math.cos((a * Math.PI) / 180) });
const add = (p: P, d: P, l: number): P => ({ x: p.x + d.x * l, y: p.y + d.y * l });

const L = { torso: 1.0, thigh: 0.92, shin: 0.9, foot: 0.42, ua: 0.58, fa: 0.52, head: 0.22, neck: 0.1 };

export type Prop =
  | { k: "plate"; at: "shoulder" | "wrist"; r?: number; dx?: number; dy?: number }
  | { k: "ball"; at: "wrist"; r?: number }
  | { k: "kb"; at: "wrist" }
  | { k: "db"; at: "wrist" }
  | { k: "box"; under: "ankle"; w?: number; dx?: number }
  | { k: "boxFront"; h: number; gap?: number; w?: number }
  | { k: "bench"; under: "farAnkle" }
  | { k: "benchBack"; w?: number }
  | { k: "band"; to: "wrist" | "farAnkle" | "ankle" | "knee"; len?: number; from?: "front" | "back" }
  | { k: "cable"; to: "wrist"; fromDir?: "front" | "top" }
  | { k: "bar"; at: "wrist" }
  | { k: "mat" }
  | { k: "seat" }
  | { k: "loop" }
  | { k: "platform" };

export interface Pose {
  /** torso */ t: number;
  /** muslo */ th: number;
  /** pierna (tibia) */ sh: number;
  /** brazo (hombro→codo) */ ua?: number;
  /** antebrazo */ fa?: number;
  /** pie (0 = plano hacia adelante = 90) */ foot?: number;
  /** pierna lejana */ fth?: number; fsh?: number; ffoot?: number;
  /** brazo lejano */ fua?: number; ffa?: number;
  /** inclinación extra de la cabeza respecto del torso */ head?: number;
  /** elevar el apoyo (p. ej. salto): sube todo respecto del piso */ lift?: number;
  props?: Prop[];
}

interface Joints {
  hip: P; shoulder: P; head: P; knee: P; ankle: P; toe: P; elbow: P; wrist: P;
  fknee: P; fankle: P; ftoe: P; felbow: P; fwrist: P;
}

function solve(p: Pose): Joints {
  const hip = { x: 0, y: 0 };
  const td = dir(p.t);
  // en pantalla "arriba" es y negativo; dir() usa 0 = abajo, así que el torso (180 = arriba) ya apunta bien
  const shoulder = add(hip, td, L.torso);
  const head = add(shoulder, dir(p.t + (p.head ?? 0)), L.neck + L.head);
  const knee = add(hip, dir(p.th), L.thigh);
  const ankle = add(knee, dir(p.sh), L.shin);
  const toe = add(ankle, dir(p.foot ?? 90), L.foot);
  const ua = p.ua ?? 0, fa = p.fa ?? 0;
  const elbow = add(shoulder, dir(ua), L.ua);
  const wrist = add(elbow, dir(fa), L.fa);
  const fth = p.fth ?? p.th, fsh = p.fsh ?? p.sh;
  const fknee = add(hip, dir(fth), L.thigh);
  const fankle = add(fknee, dir(fsh), L.shin);
  const ftoe = add(fankle, dir(p.ffoot ?? p.foot ?? 90), L.foot);
  const felbow = add(shoulder, dir(p.fua ?? ua), L.ua);
  const fwrist = add(felbow, dir(p.ffa ?? fa), L.fa);
  return { hip, shoulder, head, knee, ankle, toe, elbow, wrist, fknee, fankle, ftoe, felbow, fwrist };
}

let U = 44; // px por unidad (se ajusta por figura para que entre completa)
const W = 200;
const H = 178;
const GROUND = 150;
let TOP = 0;

const COL = { near: "#E7ECF2", far: "#6B7A8C", accent: "#4FD1C5", prop: "#B79BEF", floor: "#3A4656", bg: "#171E27", propFill: "#232B3D" };

function frameSvg(p: Pose, ox: number): string {
  const j = solve(p);
  const pts = Object.values(j);
  // el punto más bajo apoya en el piso
  const lowest = Math.max(...pts.map((q) => q.y + (q === j.toe || q === j.ftoe ? 0.05 : 0)));
  const lift = p.lift ?? 0;
  // centrar en x con el cuadro de la figura
  const minX = Math.min(...pts.map((q) => q.x)), maxX = Math.max(...pts.map((q) => q.x));
  const cx = (minX + maxX) / 2;
  const T = (q: P): P => ({ x: ox + W / 2 + (q.x - cx) * U, y: GROUND + (q.y - lowest) * U - lift * U });
  const g: Record<keyof Joints, P> = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, T(v as P)])) as Record<keyof Joints, P>;
  const line = (a: P, b: P, c: string, w: number) => `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const poly = (pts2: P[], c: string, w: number) => `<polyline points="${pts2.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

  const out: string[] = [];
  const gy = GROUND + 2;
  // piso con degradé y un leve resplandor bajo los pies
  out.push(`<rect x="${ox + 10}" y="${gy - 1}" width="${W - 20}" height="2" rx="1" fill="url(#gfloor)"/>`);
  if (!lift) out.push(`<ellipse cx="${(ox + W / 2).toFixed(1)}" cy="${gy}" rx="${(1.3 * U).toFixed(1)}" ry="4" fill="rgba(79,209,197,.10)"/>`);

  // props detrás de la figura
  const propSvg: string[] = [];
  for (const pr of p.props ?? []) {
    if (pr.k === "box") {
      const a = g.ankle;
      const w = (pr.w ?? 1.1) * U, x0 = a.x + (pr.dx ?? -0.2) * U - w / 2 + w / 2;
      propSvg.push(`<rect x="${(x0 - w / 2).toFixed(1)}" y="${(a.y + 4).toFixed(1)}" width="${w.toFixed(1)}" height="${(gy - a.y - 4).toFixed(1)}" rx="3" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="1.5"/>`);
    } else if (pr.k === "boxFront") {
      const t = g.toe;
      const x0 = t.x + (pr.gap ?? 0.25) * U, w = (pr.w ?? 1.0) * U, hh = pr.h * U;
      propSvg.push(`<rect x="${x0.toFixed(1)}" y="${(gy - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="3" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="1.5"/>`);
    } else if (pr.k === "bench") {
      const a = g.fankle;
      propSvg.push(`<rect x="${(a.x - 0.9 * U).toFixed(1)}" y="${(a.y + 4).toFixed(1)}" width="${(1.15 * U).toFixed(1)}" height="${(gy - a.y - 4).toFixed(1)}" rx="3" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="1.5"/>`);
    } else if (pr.k === "benchBack") {
      const s = g.shoulder;
      const w = (pr.w ?? 1.0) * U;
      propSvg.push(`<rect x="${(s.x - w + 0.15 * U).toFixed(1)}" y="${(s.y + 0.2 * U).toFixed(1)}" width="${w.toFixed(1)}" height="${(gy - s.y - 0.2 * U).toFixed(1)}" rx="3" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="1.5"/>`);
    } else if (pr.k === "platform") {
      const a = g.ankle;
      propSvg.push(`<rect x="${(a.x + 0.05 * U).toFixed(1)}" y="${(a.y - 0.7 * U).toFixed(1)}" width="5" height="${(1.4 * U).toFixed(1)}" rx="2" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="1.5"/>`);
    } else if (pr.k === "seat") {
      const h = g.hip;
      propSvg.push(`<rect x="${(h.x - 0.6 * U).toFixed(1)}" y="${(h.y + 5).toFixed(1)}" width="${(1.2 * U).toFixed(1)}" height="${(gy - h.y - 5).toFixed(1)}" rx="3" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="1.5"/>`);
    } else if (pr.k === "mat") {
      propSvg.push(`<rect x="${ox + 14}" y="${gy - 3}" width="${W - 28}" height="5" rx="2" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="1"/>`);
    } else if (pr.k === "band") {
      const to = pr.to === "wrist" ? g.wrist : pr.to === "farAnkle" ? g.fankle : pr.to === "knee" ? g.knee : g.ankle;
      const len = (pr.len ?? 1.5) * U;
      const from = pr.from === "back" ? { x: to.x - len, y: to.y } : { x: to.x + len, y: to.y };
      propSvg.push(line(from, to, COL.prop, 2.5) + `<circle cx="${from.x.toFixed(1)}" cy="${from.y.toFixed(1)}" r="4" fill="${COL.prop}"/>`);
    } else if (pr.k === "cable") {
      const w = g.wrist;
      const from = pr.fromDir === "top" ? { x: w.x + 0.1 * U, y: 10 } : { x: w.x + 1.5 * U, y: w.y };
      propSvg.push(line(from, w, COL.prop, 2) + `<circle cx="${from.x.toFixed(1)}" cy="${from.y.toFixed(1)}" r="4" fill="${COL.prop}"/>`);
    }
  }
  out.push(...propSvg);

  const wl = U * 0.2, wa = U * 0.17, wt = U * 0.27;
  // extremidades lejanas
  out.push(poly([g.hip, g.fknee, g.fankle, g.ftoe], COL.far, wl));
  out.push(poly([g.shoulder, g.felbow, g.fwrist], COL.far, wa));
  // torso y cuello
  out.push(line(g.hip, g.shoulder, COL.near, wt));
  out.push(line(g.shoulder, g.head, COL.near, wa));
  // extremidades cercanas
  out.push(poly([g.hip, g.knee, g.ankle, g.toe], COL.near, wl));
  out.push(poly([g.shoulder, g.elbow, g.wrist], COL.accent, wa));
  // articulaciones (puntos del color del fondo) y manos
  const dot = (q: P, r: number, c: string) => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}"/>`;
  for (const q of [g.knee, g.ankle]) out.push(dot(q, U * 0.055, COL.bg));
  out.push(dot(g.elbow, U * 0.05, COL.bg), dot(g.wrist, U * 0.085, COL.accent));
  // cabeza
  const hc = g.head;
  out.push(`<circle cx="${hc.x.toFixed(1)}" cy="${hc.y.toFixed(1)}" r="${(L.head * U).toFixed(1)}" fill="${COL.bg}" stroke="${COL.near}" stroke-width="${(U * 0.09).toFixed(1)}"/>`);

  // props delante de la figura (en la mano / hombro)
  for (const pr of p.props ?? []) {
    if (pr.k === "loop") {
      out.push(`<ellipse cx="${g.knee.x.toFixed(1)}" cy="${g.knee.y.toFixed(1)}" rx="5" ry="10" fill="none" stroke="${COL.prop}" stroke-width="3"/>`);
    } else if (pr.k === "plate") {
      const c = pr.at === "shoulder" ? g.shoulder : g.wrist;
      const r = (pr.r ?? 0.34) * U;
      const cx2 = c.x + (pr.dx ?? 0) * U, cy2 = c.y + (pr.dy ?? 0) * U;
      out.push(`<circle cx="${cx2.toFixed(1)}" cy="${cy2.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${COL.prop}" stroke-width="3"/><circle cx="${cx2.toFixed(1)}" cy="${cy2.toFixed(1)}" r="3" fill="${COL.prop}"/>`);
    } else if (pr.k === "ball") {
      const c = g.wrist, r = (pr.r ?? 0.26) * U;
      out.push(`<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="2.5"/>`);
    } else if (pr.k === "kb") {
      const c = g.wrist, r = 0.24 * U;
      out.push(`<circle cx="${c.x.toFixed(1)}" cy="${(c.y + r * 0.9).toFixed(1)}" r="${r.toFixed(1)}" fill="${COL.propFill}" stroke="${COL.prop}" stroke-width="2.5"/><path d="M ${(c.x - r * 0.5).toFixed(1)} ${(c.y + r * 0.2).toFixed(1)} q ${(r * 0.5).toFixed(1)} ${(-r * 0.9).toFixed(1)} ${r.toFixed(1)} 0" fill="none" stroke="${COL.prop}" stroke-width="2.5"/>`);
    } else if (pr.k === "db") {
      const c = g.wrist;
      out.push(`<rect x="${(c.x - 7).toFixed(1)}" y="${(c.y - 4).toFixed(1)}" width="14" height="8" rx="2" fill="${COL.prop}"/>`);
    } else if (pr.k === "bar") {
      const c = g.wrist;
      out.push(line({ x: c.x - 0.35 * U, y: c.y }, { x: c.x + 0.35 * U, y: c.y }, COL.prop, 4));
    }
  }
  return out.join("");
}

export interface FigureDef {
  frames: Pose[];
  /** Etiquetas de cada cuadro (por defecto «Inicio» y «Final», o «Posición» si es un solo cuadro). */
  labels?: string[];
  /** Aclaración que se muestra debajo de la figura (p. ej. «vista de frente»). */
  note?: string;
}

/** SVG completo con 1 o 2 cuadros (siempre el mismo tamaño). Los colores son fijos (oscuro) porque la app es de tema oscuro. */
export function figureSvg(def: FigureDef, title: string): string {
  const n = def.frames.length;
  // Todas las figuras comparten escala y lienzo (2 cuadros de ancho), así las tarjetas miden lo mismo
  // tengan una o dos posiciones.
  U = 34;
  TOP = 0;
  const x0 = n === 1 ? W / 2 : 0;
  const labels = def.labels ?? (n === 1 ? ["Posición"] : ["Inicio", "Final"]);
  const body = def.frames.map((f, i) => `<g transform="translate(${x0 + i * W} 0)">${frameSvg(f, 0)}</g>`).join("");
  const texts = labels.map((t, i) => {
    const cx = x0 + i * W + W / 2, tw = t.length * 5.7, ly = H - 9;
    const badge = n > 1 ? `<circle cx="${(cx - tw / 2 - 11).toFixed(1)}" cy="${ly - 3.5}" r="7.5" fill="#2A5C56"/><text x="${(cx - tw / 2 - 11).toFixed(1)}" y="${ly - 0.2}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#4FD1C5" font-family="system-ui,sans-serif">${i + 1}</text>` : "";
    return `${badge}<text x="${(n > 1 ? cx + 4 : cx).toFixed(1)}" y="${ly}" text-anchor="middle" font-size="11" fill="#8A97A6" font-family="system-ui,sans-serif">${t}</text>`;
  }).join("");
  const arrow = Array.from({ length: n - 1 }, (_, i) => `<circle cx="${(i + 1) * W}" cy="${GROUND - 46}" r="11" fill="#1E2733" stroke="#2A3441"/><path d="M ${(i + 1) * W - 3} ${GROUND - 51} l 5 5 l -5 5" fill="none" stroke="#4FD1C5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  const defs = `<defs><linearGradient id="gfloor" x1="0" x2="1"><stop offset="0" stop-color="#3A4656" stop-opacity="0"/><stop offset=".2" stop-color="#3A4656"/><stop offset=".8" stop-color="#3A4656"/><stop offset="1" stop-color="#3A4656" stop-opacity="0"/></linearGradient></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * 2} ${H}" role="img" aria-label="${title.replace(/"/g, "'")}" style="width:100%;max-width:440px;height:auto;display:block">${defs}${body}${arrow}${texts}</svg>`;
}

const STAND: Pose = { t: 180, th: 0, sh: 0 };
const SQ_BOTTOM: Pose = { t: 150, th: 85, sh: -25 };

/** Figuras por id de ejercicio (ver el catálogo en training-engine/strength.ts). Los que faltan se muestran sin figura. */
export const FIGURES: Record<string, FigureDef> = {
  goblet: {
    frames: [
      { ...STAND, ua: 30, fa: 150, props: [{ k: "kb", at: "wrist" }] },
      { ...SQ_BOTTOM, ua: 25, fa: 150, props: [{ k: "kb", at: "wrist" }] },
    ],
  },
  sentadilla_barra: {
    frames: [
      { ...STAND, ua: -30, fa: 165, props: [{ k: "plate", at: "shoulder", dx: -0.34, dy: 0.02, r: 0.26 }] },
      { ...SQ_BOTTOM, t: 145, ua: -30, fa: 165, props: [{ k: "plate", at: "shoulder", dx: -0.34, dy: 0.02, r: 0.26 }] },
    ],
  },
  prensa: {
    frames: [
      { t: -125, th: 150, sh: 70, ua: 0, props: [{ k: "benchBack", w: 0.8 }, { k: "platform" }] },
      { t: -125, th: 125, sh: 125, ua: 0, props: [{ k: "benchBack", w: 0.8 }, { k: "platform" }] },
    ],
    labels: ["Rodillas flexionadas", "Piernas casi estiradas"],
  },
  pm_rumano: {
    frames: [
      { ...STAND, ua: 0, fa: 0, props: [{ k: "db", at: "wrist" }] },
      { t: 100, th: 15, sh: -5, ua: 0, fa: 0, props: [{ k: "db", at: "wrist" }] },
    ],
  },
  buenos_dias: {
    frames: [
      { ...STAND, ua: -30, fa: 165, props: [{ k: "plate", at: "shoulder", dx: -0.34, dy: 0.02, r: 0.26 }] },
      { t: 105, th: 15, sh: -5, ua: -30, fa: 165, props: [{ k: "plate", at: "shoulder", dx: -0.34, dy: 0.02, r: 0.26 }] },
    ],
  },
  pm_unipodal: {
    frames: [
      { ...STAND, fth: -10, fsh: -10, ua: 0, fa: 0, props: [{ k: "db", at: "wrist" }] },
      { t: 95, th: 5, sh: 0, fth: -90, fsh: -90, ffoot: 0, ua: 0, fa: 0, props: [{ k: "db", at: "wrist" }] },
    ],
  },
  bulgara: {
    frames: [
      { ...STAND, fth: -30, fsh: -82, ffoot: -90, ua: 0, props: [{ k: "bench", under: "farAnkle" }] },
      { t: 165, th: 80, sh: -10, fth: -65, fsh: -105, ffoot: -90, ua: 0, props: [{ k: "bench", under: "farAnkle" }] },
    ],
  },
  estocada: {
    frames: [
      { ...STAND, ua: 0 },
      { t: 175, th: 85, sh: -5, fth: -25, fsh: -110, ffoot: 10, ua: 0 },
    ],
  },
  step_up: {
    frames: [
      { t: 170, th: 70, sh: -45, fth: -5, fsh: -5, ua: 0, props: [{ k: "box", under: "ankle" }] },
      { ...STAND, fth: 50, fsh: -20, lift: 0.9, ua: 0, props: [{ k: "box", under: "ankle" }] },
    ],
  },
  puente_gluteo: {
    frames: [
      { t: -130, th: 134, sh: -10, ua: 60, fa: 60, props: [{ k: "benchBack", w: 0.9 }, { k: "bar", at: "wrist" }] },
      { t: -95, th: 85, sh: 0, ua: 60, fa: 60, props: [{ k: "benchBack", w: 0.9 }, { k: "bar", at: "wrist" }] },
    ],
    labels: ["Abajo", "Cadera arriba"],
  },
  gemelos: {
    frames: [{ ...STAND, ua: 0 }, { ...STAND, foot: 5, ua: 0 }],
    labels: ["Abajo", "Arriba (pausa)"],
  },
  flexiones: {
    frames: [
      { t: 100, th: -70, sh: -70, foot: 10, ua: 0, fa: 0 },
      { t: 95, th: -80, sh: -80, foot: 10, ua: -45, fa: 45 },
    ],
    labels: ["Brazos estirados", "Pecho cerca del piso"],
  },
  remo: {
    frames: [
      { t: 110, th: 15, sh: -10, ua: 0, fa: 0, fua: 40, ffa: 60, props: [{ k: "db", at: "wrist" }] },
      { t: 110, th: 15, sh: -10, ua: -105, fa: 0, fua: 40, ffa: 60, props: [{ k: "db", at: "wrist" }] },
    ],
    labels: ["Brazo estirado", "Codo hacia atrás"],
  },
  jalon: {
    frames: [
      { t: 190, th: 90, sh: 0, ua: 170, fa: 175, props: [{ k: "seat" }, { k: "cable", to: "wrist", fromDir: "top" }, { k: "bar", at: "wrist" }] },
      { t: 190, th: 90, sh: 0, ua: -20, fa: 150, props: [{ k: "seat" }, { k: "cable", to: "wrist", fromDir: "top" }, { k: "bar", at: "wrist" }] },
    ],
    labels: ["Brazos arriba", "Barra al pecho"],
  },
  cmj: {
    frames: [
      { t: 155, th: 65, sh: -35, ua: -60, fa: -60 },
      { ...STAND, foot: 30, ua: 135, fa: 150, lift: 0.3 },
    ],
    labels: ["Bajada rápida", "Salto (aterrizá suave)"],
  },
  salto_cajon: {
    frames: [
      { t: 155, th: 65, sh: -35, ua: -60, fa: -60, props: [{ k: "boxFront", h: 0.7, gap: 0.4 }] },
      { t: 160, th: 75, sh: -30, ua: 50, fa: 60, lift: 0.7, props: [{ k: "box", under: "ankle" }] },
    ],
    labels: ["Preparación", "Aterrizaje sobre el cajón"],
  },
  swing_kb: {
    frames: [
      { t: 110, th: 20, sh: -10, ua: -30, fa: -30, props: [{ k: "kb", at: "wrist" }] },
      { ...STAND, ua: 90, fa: 90, props: [{ k: "kb", at: "wrist" }] },
    ],
    labels: ["Abajo (cadera atrás)", "Arriba (cadera extendida)"],
  },
  slam: {
    frames: [
      { t: 185, th: 0, sh: 0, ua: 170, fa: 175, props: [{ k: "ball", at: "wrist", r: 0.3 }] },
      { t: 110, th: 70, sh: -40, ua: 20, fa: 20, props: [{ k: "ball", at: "wrist", r: 0.3 }] },
    ],
    labels: ["Balón arriba", "Lanzamiento al piso"],
  },
  patinador: {
    frames: [{ t: 155, th: 45, sh: -30, fth: -40, fsh: -100, ua: -30, fa: -30 }],
    labels: ["Aterrizaje"],
    note: "Salto largo hacia el costado y aterrizaje estable en una pierna (1-2 s). Acá se ve de perfil.",
  },
  salto_unipodal: {
    frames: [
      { t: 165, th: 25, sh: 10, fth: 70, fsh: -10, ua: 80, fa: 80, lift: 0.5 },
      { t: 155, th: 40, sh: -25, fth: -30, fsh: -100, ua: 50, fa: 50 },
    ],
    labels: ["En el aire", "Aterrizaje estable"],
  },
  plancha: {
    frames: [{ t: 95, th: -84, sh: -84, foot: 10, ua: 0, fa: 90 }],
  },
  hollow: {
    frames: [{ t: -115, th: 112, sh: 112, ua: -112, fa: -112, props: [{ k: "mat" }] }],
  },
  plancha_lat: {
    frames: [{ t: 110, th: -70, sh: -70, ua: 0, fa: 20, fua: 180, ffa: 180 }],
    note: "Vista de frente.",
  },
  pallof: {
    frames: [
      { ...STAND, ua: 30, fa: 140, props: [{ k: "band", to: "wrist", from: "back", len: 1.6 }] },
      { ...STAND, ua: 90, fa: 90, props: [{ k: "band", to: "wrist", from: "back", len: 1.6 }] },
    ],
    note: "El anclaje de la banda va al costado del cuerpo; acá se ve de perfil.",
  },
  carry: {
    frames: [{ t: 180, th: 20, sh: 5, fth: -20, fsh: -35, ua: 0, fa: 0, fua: 0, ffa: 0, props: [{ k: "db", at: "wrist" }] }],
  },
  dead_bug: {
    frames: [
      { t: -90, th: 180, sh: 90, ua: 180, fa: 180, props: [{ k: "mat" }] },
      { t: -90, th: 100, sh: 100, fth: 180, fsh: 90, ua: 180, ffa: -90, fua: -90, props: [{ k: "mat" }] },
    ],
  },
  bird_dog: {
    frames: [
      { t: 100, th: 0, sh: -90, ua: 0, fa: 0, fth: 0, fsh: -90 },
      { t: 100, th: -80, sh: -80, foot: 10, ua: 0, fa: 0, fua: 90, ffa: 90, fth: 0, fsh: -90 },
    ],
  },
  apoyo_unipodal: {
    frames: [{ t: 180, th: 0, sh: 0, fth: -10, fsh: -100, ua: 0 }],
  },
  alcance_y: {
    frames: [
      { t: 160, th: 30, sh: -20, fth: 25, fsh: 25, ffoot: 60, ua: -30, fa: -30 },
      { t: 160, th: 30, sh: -20, fth: -25, fsh: -25, ffoot: 30, ua: 60, fa: 60 },
    ],
    labels: ["Alcance adelante", "Alcance atrás"],
  },
  banda_lateral: {
    frames: [{ t: 160, th: 40, sh: -25, ua: 40, fa: 40, props: [{ k: "loop" }] }],
    note: "Banda en las rodillas, media sentadilla; los pasos son hacia el costado.",
  },
  bajada_cajon: {
    frames: [
      { ...STAND, fth: 10, fsh: 10, lift: 0.7, ua: 0, props: [{ k: "box", under: "ankle" }] },
      { t: 160, th: 65, sh: -45, fth: 18, fsh: 18, ffoot: 60, ua: 50, fa: 50, props: [{ k: "box", under: "ankle" }] },
    ],
    labels: ["Arriba del cajón", "Baja el pie libre al piso"],
  },
};
