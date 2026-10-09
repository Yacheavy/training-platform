/**
 * Estructura del análisis de una sesión: tres secciones con título («### Lo que salió bien», «### Para mirar», «### Lo que sigue»).
 * Lo comparten el chat (que lo dibuja con íconos) y el mail. Si el texto no trae secciones, devuelve null y se muestra como texto corrido.
 */
export type SectionKey = "good" | "watch" | "next" | "other";
export interface Block { type: "p" | "li"; text: string }
export interface AnalysisSection { key: SectionKey; heading: string; blocks: Block[] }
export interface ParsedAnalysis { intro: Block[]; sections: AnalysisSection[]; sources: string | null }

/** Ícono de línea de 24×24 por sección (el mismo dibujo en la app, en SVG, y en el mail, en PNG). */
export const SECTION_META: Record<SectionKey, { color: string; svg: string }> = {
  good: { color: "#4FD1C5", svg: '<circle cx="12" cy="12" r="9"/><path d="m8.2 12.4 2.7 2.7 5-5.6"/>' },
  watch: { color: "#E8A33D", svg: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' },
  next: { color: "#7FB2F0", svg: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12.5 8.2 16.3 12l-3.8 3.8"/>' },
  other: { color: "#8A97A6", svg: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.2v.1"/>' },
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

function keyFor(heading: string): SectionKey {
  const n = norm(heading);
  if (/\b(salio bien|lo bueno|bien)\b/.test(n)) return "good";
  if (/\b(para mirar|a mirar|mirar|atencion|ojo)\b/.test(n)) return "watch";
  if (/\b(sigue|proximos|proximo|de ahora|que hacer)\b/.test(n)) return "next";
  return "other";
}

export function parseAnalysis(text: string): ParsedAnalysis | null {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ParsedAnalysis = { intro: [], sections: [], sources: null };
  let current: AnalysisSection | null = null;
  let para: string[] = [];
  const target = () => (current ? current.blocks : out.intro);
  const flush = () => {
    if (para.length) target().push({ type: "p", text: para.join(" ").trim() });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(/^#{1,4}\s+(.+)$/) ?? line.match(/^\*\*([^*]+?)\*\*:?$/);
    if (h && (line.startsWith("#") || keyFor(h[1]) !== "other")) {
      flush();
      const heading = h[1].replace(/[*:]+$/g, "").trim();
      current = { key: keyFor(heading), heading, blocks: [] };
      out.sections.push(current);
      continue;
    }
    const src = line.match(/^fuentes?:\s*(.+)$/i);
    if (src) { flush(); out.sources = src[1].trim(); continue; }
    const li = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (li) { flush(); target().push({ type: "li", text: li[1].trim() }); continue; }
    para.push(line);
  }
  flush();
  return out.sections.length > 0 ? out : null;
}
