export interface ParsedResponse {
  text: string;
  updatedBlocks: { type: string; durationSec: number; targetWatts: number }[] | null;
}

export function parseClaudeResponse(raw: string): ParsedResponse {
  const match = raw.match(/```json_blocks\s*([\s\S]*?)\s*```/);

  if (!match) {
    return { text: raw.trim(), updatedBlocks: null };
  }

  const text = raw.replace(match[0], "").trim();

  try {
    const updatedBlocks = JSON.parse(match[1]);
    return { text, updatedBlocks };
  } catch {
    // Si el JSON viene mal formado, no rompemos el chat — devolvemos
    // solo el texto y dejamos los bloques sin tocar
    return { text: raw.trim(), updatedBlocks: null };
  }
}