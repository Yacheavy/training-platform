export interface ParsedResponse {
  text: string;
  /** Contenido del bloque json_blocks SIN validar (hay que pasarlo por validateBlocks). */
  updatedBlocks: unknown | null;
  /** El modelo incluyó un bloque json_blocks pero no se pudo leer (mal formado o cortado). */
  blocksUnreadable: boolean;
}

export function parseClaudeResponse(raw: string): ParsedResponse {
  const match = raw.match(/```json_blocks\s*([\s\S]*?)\s*```/);

  if (!match) {
    // Bloque abierto pero sin cierre (respuesta cortada): no mostrar JSON a medias al usuario
    const open = raw.indexOf("```json_blocks");
    if (open >= 0) return { text: raw.slice(0, open).trim(), updatedBlocks: null, blocksUnreadable: true };
    return { text: raw.trim(), updatedBlocks: null, blocksUnreadable: false };
  }

  const text = raw.replace(match[0], "").trim();

  try {
    return { text, updatedBlocks: JSON.parse(match[1]), blocksUnreadable: false };
  } catch {
    return { text, updatedBlocks: null, blocksUnreadable: true };
  }
}
