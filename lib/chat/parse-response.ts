export interface ParsedResponse {
  text: string;
  /** Contenido del bloque json_blocks SIN validar (hay que pasarlo por validateBlocks). */
  updatedBlocks: unknown | null;
  /** El modelo incluyó un bloque json_blocks pero no se pudo leer (mal formado o cortado). */
  blocksUnreadable: boolean;
  /** Opciones para mostrar como botones (bloque ```opciones). */
  options: string[];
}

const OPTIONS_RE = /```opciones\s*([\s\S]*?)\s*```/;

function readOptions(raw: string): string[] {
  const m = raw.match(OPTIONS_RE);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1]);
    if (!Array.isArray(arr)) return [];
    return arr.filter((o): o is string => typeof o === "string" && o.trim().length > 0 && o.length <= 120).map((o) => o.trim()).slice(0, 4);
  } catch {
    return [];
  }
}

/** Separa el texto visible de las opciones (para renderizar botones en el cliente). */
export function splitOptions(content: string): { text: string; options: string[] } {
  return { text: content.replace(OPTIONS_RE, "").trim(), options: readOptions(content) };
}

export function parseClaudeResponse(input: string): ParsedResponse {
  const options = readOptions(input);
  const raw = input.replace(OPTIONS_RE, "").replace(/```opciones[\s\S]*$/, "");
  const match = raw.match(/```json_blocks\s*([\s\S]*?)\s*```/);

  if (!match) {
    // Bloque abierto pero sin cierre (respuesta cortada): no mostrar JSON a medias al usuario
    const open = raw.indexOf("```json_blocks");
    if (open >= 0) return { text: raw.slice(0, open).trim(), updatedBlocks: null, blocksUnreadable: true, options };
    return { text: raw.trim(), updatedBlocks: null, blocksUnreadable: false, options };
  }

  const text = raw.replace(match[0], "").trim();

  try {
    return { text, updatedBlocks: JSON.parse(match[1]), blocksUnreadable: false, options };
  } catch {
    return { text, updatedBlocks: null, blocksUnreadable: true, options };
  }
}
