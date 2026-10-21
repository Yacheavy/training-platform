/**
 * Señales de recuperación (HRV y FC de reposo) contra la LÍNEA BASE INDIVIDUAL del atleta.
 *
 * Método (Plews et al. 2013, Sports Med; Alfonso et al. 2025, Sci Rep):
 *  - HRV en escala logarítmica (LnRMSSD).
 *  - Línea base: media y desvío de los 60 días previos (sin incluir hoy), mínimo 28 datos.
 *  - Se compara la MEDIA MÓVIL DE 7 DÍAS (incluye hoy, mínimo 4 datos) y no el valor de un día.
 *  - HRV: alerta si la media móvil cae bajo (media base − 0,5·DE) (≈ SWC de Plews = 0,5 × CV).
 *  - FC de reposo: alerta si la media móvil supera (media base + 1·DE). Señal secundaria.
 * Mientras no haya 28 datos de línea base se usa un respaldo genérico (explícito en el motivo):
 *  HRV: media de 7 días previos vs. umbral porcentual; FC: +5 lpm. Son heurísticas, no individualizadas.
 *
 * Las muestras de HRV de reloj de muñeca (PPG) no equivalen a ECG: se interpretan como tendencia.
 */
export interface DailyPoint {
  /** Medianoche UTC del día calendario del atleta (clave de día). */
  date: Date;
  hrv: number | null;
  restingHr: number | null;
}

export type SignalMethod = "baseline" | "fallback" | "insufficient";

export interface SignalResult {
  method: SignalMethod;
  triggered: boolean;
  /** Media móvil de 7 días (valor natural: ms o lpm). null si hay <4 datos. */
  rolling7: number | null;
  /** Media de la línea base (valor natural). null si no hay línea base. */
  baseline: number | null;
  /** Cambio relativo de la media móvil vs. línea base (HRV, %), o diferencia absoluta (FC, lpm). */
  delta: number | null;
  reason: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_BASELINE_DAYS = 28;
export const MIN_ROLLING_DAYS = 4;

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
function sd(a: number[]): number {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

function windows(points: DailyPoint[], todayKey: Date, pick: (p: DailyPoint) => number | null) {
  const t = todayKey.getTime();
  const val = (lo: number, hi: number) =>
    points
      .filter((p) => p.date.getTime() >= t - lo * DAY_MS && p.date.getTime() <= t - hi * DAY_MS)
      .map(pick)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  return {
    rolling: val(6, 0), // días -6..0 (incluye hoy)
    previous6: val(6, 1), // días -6..-1 (para el respaldo)
    baseline: val(60, 1), // días -60..-1
  };
}

export function hrvSignal(points: DailyPoint[], todayKey: Date, fallbackDropPct = 7.5): SignalResult {
  const { rolling, previous6, baseline } = windows(points, todayKey, (p) => p.hrv);
  const todayVal = points.find((p) => p.date.getTime() === todayKey.getTime())?.hrv ?? null;

  if (baseline.length >= MIN_BASELINE_DAYS && rolling.length >= MIN_ROLLING_DAYS) {
    const lnBase = baseline.map(Math.log);
    const bMean = mean(lnBase);
    const bSd = sd(lnBase);
    const rMean = mean(rolling.map(Math.log));
    const lowerBound = bMean - 0.5 * bSd;
    const deltaPct = (Math.exp(rMean - bMean) - 1) * 100;
    const triggered = rMean < lowerBound;
    return {
      method: "baseline",
      triggered,
      rolling7: Math.exp(rMean),
      baseline: Math.exp(bMean),
      delta: deltaPct,
      reason: triggered
        ? `HRV: tu media de 7 días (${Math.exp(rMean).toFixed(0)} ms) está ${Math.abs(deltaPct).toFixed(1)}% bajo tu línea base de ${baseline.length} días (${Math.exp(bMean).toFixed(0)} ms), por debajo de tu rango habitual`
        : null,
    };
  }

  if (todayVal != null && previous6.length >= MIN_ROLLING_DAYS) {
    const ref = mean(previous6);
    const deltaPct = ((todayVal - ref) / ref) * 100;
    const triggered = deltaPct < -fallbackDropPct;
    return {
      method: "fallback",
      triggered,
      rolling7: mean(rolling),
      baseline: ref,
      delta: deltaPct,
      reason: triggered
        ? `HRV de hoy ${deltaPct.toFixed(1)}% bajo la media de tus 6 días previos (umbral genérico −${fallbackDropPct}%; aún no hay ${MIN_BASELINE_DAYS} días para tu línea base individual)`
        : null,
    };
  }

  return { method: "insufficient", triggered: false, rolling7: rolling.length >= MIN_ROLLING_DAYS ? mean(rolling) : null, baseline: null, delta: null, reason: null };
}

export function restingHrSignal(points: DailyPoint[], todayKey: Date, fallbackBpm = 5): SignalResult {
  const { rolling, previous6, baseline } = windows(points, todayKey, (p) => p.restingHr);
  const todayVal = points.find((p) => p.date.getTime() === todayKey.getTime())?.restingHr ?? null;

  if (baseline.length >= MIN_BASELINE_DAYS && rolling.length >= MIN_ROLLING_DAYS) {
    const bMean = mean(baseline);
    const bSd = sd(baseline);
    const rMean = mean(rolling);
    const triggered = rMean > bMean + bSd;
    return {
      method: "baseline",
      triggered,
      rolling7: rMean,
      baseline: bMean,
      delta: rMean - bMean,
      reason: triggered
        ? `FC de reposo: media de 7 días ${rMean.toFixed(1)} lpm, ${(rMean - bMean).toFixed(1)} sobre tu línea base (${bMean.toFixed(1)} lpm), por encima de tu rango habitual`
        : null,
    };
  }

  if (todayVal != null && previous6.length >= MIN_ROLLING_DAYS) {
    const ref = mean(previous6);
    const diff = todayVal - ref;
    const triggered = diff >= fallbackBpm;
    return {
      method: "fallback",
      triggered,
      rolling7: mean(rolling),
      baseline: ref,
      delta: diff,
      reason: triggered ? `FC de reposo de hoy ${diff.toFixed(1)} lpm sobre la media de tus 6 días previos (umbral genérico +${fallbackBpm} lpm, no individualizado)` : null,
    };
  }

  return { method: "insufficient", triggered: false, rolling7: rolling.length >= MIN_ROLLING_DAYS ? mean(rolling) : null, baseline: null, delta: null, reason: null };
}

export interface AcuteWarning {
  /** Hoy coinciden HRV muy bajo y FC de reposo muy alta. */
  today: boolean;
  /** Días de los últimos 7 (incluido hoy) en que pasó. */
  daysIn7: number;
  hrvPct: number | null;
  rhrDiff: number | null;
  message: string | null;
  /** Hoy, por separado: HRV ≤ −1,5 DE de tu línea base / FC de reposo ≥ +2 DE (aunque no coincidan). */
  hrvLowToday: boolean;
  rhrHighToday: boolean;
  hrvPctToday: number | null;
  rhrDiffToday: number | null;
}

/**
 * Aviso de «prestá atención»: el día en que HRV está muy por debajo de tu línea base Y la FC de reposo muy por encima, a la vez.
 * No cambia el semáforo (que usa medias de 7 días, más estables): solo avisa de un día que se sale de lo tuyo con las dos señales juntas.
 * Criterio PRÁCTICO del sistema (no sale de un ensayo): LnHRV ≤ media − 1,5 DE y FC de reposo ≥ media + 2 DE, cada día contra sus 60 días previos (mín. 28 datos).
 * Un día aislado puede ser sueño, alcohol, una enfermedad que empieza o ruido del reloj: se confirma con cómo te sentís y si se repite.
 */
export function acuteWarning(points: DailyPoint[], todayKey: Date): AcuteWarning {
  const t = todayKey.getTime();
  let daysIn7 = 0;
  let todayRes: { hrvPct: number; rhrDiff: number } | null = null;
  let tl = { hrvLow: false, rhrHigh: false, hrvPct: null as number | null, rhrDiff: null as number | null };
  for (let back = 0; back < 7; back++) {
    const day = t - back * DAY_MS;
    const p = points.find((x) => x.date.getTime() === day);
    if (!p || p.hrv == null || p.hrv <= 0 || p.restingHr == null || p.restingHr <= 0) {
      if (back === 0 && p) {
        // Hoy con solo uno de los dos datos: se evalúa por separado
        const base0 = points.filter((x) => x.date.getTime() >= day - 60 * DAY_MS && x.date.getTime() <= day - DAY_MS);
        if (p.hrv != null && p.hrv > 0) { const hv = base0.map((x) => x.hrv).filter((v): v is number => v != null && v > 0).map(Math.log); if (hv.length >= MIN_BASELINE_DAYS) { const m = mean(hv), s2 = sd(hv); tl.hrvLow = s2 > 0 && Math.log(p.hrv) <= m - 1.5 * s2; tl.hrvPct = (p.hrv / Math.exp(m) - 1) * 100; } }
        if (p.restingHr != null && p.restingHr > 0) { const rv = base0.map((x) => x.restingHr).filter((v): v is number => v != null && v > 0); if (rv.length >= MIN_BASELINE_DAYS) { const m = mean(rv), s2 = sd(rv); tl.rhrHigh = s2 > 0 && p.restingHr >= m + 2 * s2; tl.rhrDiff = p.restingHr - m; } }
      }
      continue;
    }
    const base = points.filter((x) => x.date.getTime() >= day - 60 * DAY_MS && x.date.getTime() <= day - DAY_MS);
    const hv = base.map((x) => x.hrv).filter((v): v is number => v != null && v > 0).map(Math.log);
    const rv = base.map((x) => x.restingHr).filter((v): v is number => v != null && v > 0);
    if (hv.length < MIN_BASELINE_DAYS || rv.length < MIN_BASELINE_DAYS) continue;
    const hm = mean(hv), hs = sd(hv), rm = mean(rv), rs = sd(rv);
    if (!(hs > 0) || !(rs > 0)) continue;
    const hrvLow = Math.log(p.hrv) <= hm - 1.5 * hs;
    const rhrHigh = p.restingHr >= rm + 2 * rs;
    if (back === 0) tl = { hrvLow, rhrHigh, hrvPct: (p.hrv / Math.exp(hm) - 1) * 100, rhrDiff: p.restingHr - rm };
    const hot = hrvLow && rhrHigh;
    if (hot) {
      daysIn7++;
      if (back === 0) todayRes = { hrvPct: (p.hrv / Math.exp(hm) - 1) * 100, rhrDiff: p.restingHr - rm };
    }
  }
  const message = todayRes
    ? `Hoy coinciden HRV muy bajo (${Math.abs(todayRes.hrvPct).toFixed(0)}% bajo tu línea base) y FC de reposo alta (+${todayRes.rhrDiff.toFixed(1)} lpm)${daysIn7 > 1 ? `; ya pasó ${daysIn7} de los últimos 7 días` : ""}. Prestá atención a cómo te sentís (sueño, estrés, molestias) y evitá sumar carga extra si se repite.`
    : null;
  return { today: !!todayRes, daysIn7, hrvPct: todayRes?.hrvPct ?? null, rhrDiff: todayRes?.rhrDiff ?? null, message, hrvLowToday: tl.hrvLow, rhrHighToday: tl.rhrHigh, hrvPctToday: tl.hrvPct, rhrDiffToday: tl.rhrDiff };
}
