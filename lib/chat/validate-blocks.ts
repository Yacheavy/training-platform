/**
 * Valida (sin confiar en el modelo) los bloques que el chat quiere guardar en un workout.
 * Devuelve los bloques normalizados o el motivo del rechazo.
 */
export type ValidBlock = { type: string; durationSec: number; targetWatts: number };

const ALLOWED_TYPES = new Set([
  "warmup_z1", "warmup_z2", "warmup_activation", "warmup_recovery", "warmup_blowout",
  "interval", "recovery", "z2", "z2_fill", "cooldown_z2", "cooldown_z1", "gym",
  "test_20min", "test_8min", "test_5min",
]);

export function validateBlocks(
  raw: unknown,
  ctx: { ftp: number; originalTotalSec?: number }
): { ok: true; blocks: ValidBlock[] } | { ok: false; reason: string } {
  if (!Array.isArray(raw)) return { ok: false, reason: "no es una lista de bloques" };
  if (raw.length < 1 || raw.length > 200) return { ok: false, reason: `cantidad de bloques fuera de rango (${raw.length})` };

  const blocks: ValidBlock[] = [];
  for (const [i, b] of raw.entries()) {
    if (!b || typeof b !== "object") return { ok: false, reason: `bloque ${i + 1} inválido` };
    const { type, durationSec, targetWatts } = b as Record<string, unknown>;
    if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) return { ok: false, reason: `bloque ${i + 1}: tipo "${String(type)}" no permitido` };
    if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 1 || durationSec > 6 * 3600)
      return { ok: false, reason: `bloque ${i + 1}: duración inválida` };
    const maxW = Math.round(ctx.ftp * 2.5);
    if (typeof targetWatts !== "number" || !Number.isFinite(targetWatts) || targetWatts < 0 || targetWatts > maxW)
      return { ok: false, reason: `bloque ${i + 1}: potencia fuera de rango (máx. ${maxW} W)` };
    blocks.push({ type, durationSec: Math.round(durationSec), targetWatts: Math.round(targetWatts) });
  }

  const total = blocks.reduce((s, b) => s + b.durationSec, 0);
  if (total > 8 * 3600) return { ok: false, reason: "la sesión supera las 8 horas" };
  if (ctx.originalTotalSec && total > ctx.originalTotalSec * 2.5) return { ok: false, reason: "la duración total creció más de 2,5 veces respecto a la original" };
  return { ok: true, blocks };
}
