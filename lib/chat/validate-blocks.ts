/**
 * Valida (sin confiar en el modelo) los bloques que el chat quiere guardar en un workout.
 * Devuelve los bloques normalizados o el motivo del rechazo.
 */
export type ValidBlock = { type: string; durationSec: number; targetWatts: number; cadenceRpm?: number };

const ALLOWED_TYPES = new Set([
  "warmup_z1", "warmup_z2", "warmup_activation", "warmup_recovery", "warmup_blowout",
  "interval", "recovery", "z2", "z2_fill", "cooldown_z2", "cooldown_z1", "gym",
  "test_20min", "test_8min", "test_5min",
]);

export function validateBlocks(
  raw: unknown,
  ctx: { ftp: number; originalTotalSec?: number; originalTypes?: string[] }
): { ok: true; blocks: ValidBlock[] } | { ok: false; reason: string } {
  if (!Array.isArray(raw)) return { ok: false, reason: "no es una lista de bloques" };
  if (raw.length < 1 || raw.length > 200) return { ok: false, reason: `cantidad de bloques fuera de rango (${raw.length})` };

  const blocks: ValidBlock[] = [];
  for (const [i, b] of raw.entries()) {
    if (!b || typeof b !== "object") return { ok: false, reason: `bloque ${i + 1} inválido` };
    const { type, durationSec, targetWatts, cadenceRpm } = b as Record<string, unknown>;
    if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) return { ok: false, reason: `bloque ${i + 1}: tipo "${String(type)}" no permitido` };
    if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 1 || durationSec > 6 * 3600)
      return { ok: false, reason: `bloque ${i + 1}: duración inválida` };
    const maxW = Math.round(ctx.ftp * 2.5);
    if (typeof targetWatts !== "number" || !Number.isFinite(targetWatts) || targetWatts < 0 || targetWatts > maxW)
      return { ok: false, reason: `bloque ${i + 1}: potencia fuera de rango (máx. ${maxW} W)` };
    blocks.push({
      type,
      durationSec: Math.round(durationSec),
      targetWatts: Math.round(targetWatts),
      ...(typeof cadenceRpm === "number" && Number.isFinite(cadenceRpm) && cadenceRpm >= 30 && cadenceRpm <= 130 ? { cadenceRpm: Math.round(cadenceRpm) } : {}),
    });
  }

  // Bloques de baja intensidad: no pueden superar ~90% del FTP (evita Z2 a 700 W)
  const LOW = /^(z2|z2_fill|cooldown_.*|warmup_z1|warmup_z2|warmup_recovery|recovery)$/;
  for (const [i, b] of blocks.entries()) {
    if (LOW.test(b.type) && b.type !== "recovery" && b.targetWatts > ctx.ftp * 0.9)
      return { ok: false, reason: `bloque ${i + 1}: ${b.type} a ${b.targetWatts} W supera el 90% del FTP` };
  }
  // Estructura: calentamiento primero, vuelta a la calma al final, y no perder los que ya tenía
  const firstNonWarm = blocks.findIndex((b) => !b.type.startsWith("warmup"));
  if (firstNonWarm >= 0 && blocks.slice(firstNonWarm).some((b) => b.type.startsWith("warmup")))
    return { ok: false, reason: "hay bloques de calentamiento después de empezar la parte principal" };
  const firstCool = blocks.findIndex((b) => b.type.startsWith("cooldown"));
  if (firstCool >= 0 && blocks.slice(firstCool).some((b) => !b.type.startsWith("cooldown")))
    return { ok: false, reason: "hay bloques después de la vuelta a la calma" };
  if (ctx.originalTypes) {
    if (ctx.originalTypes.some((t) => t.startsWith("warmup")) && !blocks.some((b) => b.type.startsWith("warmup")))
      return { ok: false, reason: "se perdió el calentamiento" };
    if (ctx.originalTypes.some((t) => t.startsWith("cooldown")) && !blocks.some((b) => b.type.startsWith("cooldown")))
      return { ok: false, reason: "se perdió la vuelta a la calma" };
  }

  const total = blocks.reduce((s, b) => s + b.durationSec, 0);
  if (ctx.originalTotalSec && total < ctx.originalTotalSec * 0.4) return { ok: false, reason: "la duración total quedó por debajo del 40% de la original (parece una lista incompleta)" };
  if (total > 8 * 3600) return { ok: false, reason: "la sesión supera las 8 horas" };
  if (ctx.originalTotalSec && total > ctx.originalTotalSec * 2.5) return { ok: false, reason: "la duración total creció más de 2,5 veces respecto a la original" };
  return { ok: true, blocks };
}
