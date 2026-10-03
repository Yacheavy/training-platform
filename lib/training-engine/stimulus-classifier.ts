interface ZoneTime {
  id: string; // "Z1".."Z7", "SS"
  secs: number;
}

/**
 * Clasificación v2: prioriza el tiempo real en zonas (dato objetivo del
 * potenciómetro) sobre el nombre (etiqueta humana, inconsistente para
 * fondos que casi nunca se nombraban). El nombre queda como señal de
 * refuerzo únicamente para casos ambiguos.
 *
 * Zonas de Intervals.icu (7 zonas + SS = sweet spot):
 * Z1: recuperación | Z2: aeróbico/fondo | Z3: tempo | SS: sweet spot
 * Z4: umbral | Z5: VO2max | Z6-Z7: anaeróbico/neuromuscular
 */
export function classifyStimulusType(activity: {
  type: string;
  name?: string | null;
  intensityFactor?: number | null;
  rawStreamsJson?: { zoneTimes?: ZoneTime[] } | null;
}): string {
  if (activity.type === "WeightTraining") return "gym";
  if (activity.type !== "Ride") return "other";

  const zoneTimes = activity.rawStreamsJson?.zoneTimes;

  if (zoneTimes && zoneTimes.length > 0) {
    const totalSecs = zoneTimes.reduce((sum, z) => sum + z.secs, 0);
    if (totalSecs > 0) {
      const pct = (zoneId: string) =>
        ((zoneTimes.find((z) => z.id === zoneId)?.secs ?? 0) / totalSecs) * 100;

      const pctZ1 = pct("Z1");
      const pctZ2 = pct("Z2");
      const pctZ3 = pct("Z3");
      const pctSS = pct("SS");
      const pctZ4 = pct("Z4");
      const pctZ5 = pct("Z5");
      const pctZ6 = pct("Z6");
      const pctZ7 = pct("Z7");

      const pctHighIntensity = pctZ5 + pctZ6 + pctZ7;

      if (pctZ1 + pctZ2 > 75) return "z2";

      if (pctHighIntensity > 8) {
        const name = (activity.name ?? "").toLowerCase();
        if (name.includes("hiit corto") || name.includes("30/15") || name.includes("30-15"))
          return "ronnestad_30_15";
        if (name.includes("sprint") || name.includes("rst")) return "rst";
        return "hiit_genuino";
      }

      if (pctSS > 15) return "sweet_spot";
      if (pctZ4 > 10) return "umbral";
      if (pctZ3 > pctZ1 + pctZ2) return "sweet_spot";
    }
  }

  const name = (activity.name ?? "").toLowerCase();
  if (name.includes("hiit largo")) return "hiit_genuino";
  if (name.includes("hiit corto")) return "ronnestad_30_15";
  if (name.includes("vo2max")) return "hiit_genuino";
  if (name.includes("sweet spot")) return "sweet_spot";
  if (name.includes("umbral")) return "umbral";
  if (name.includes("sprint") || name.includes("rst")) return "rst";

  const ifValue = activity.intensityFactor ?? 0;
  if (ifValue >= 85) return "hiit_genuino";
  if (ifValue >= 70) return "umbral";
  if (ifValue >= 55) return "sweet_spot";
  return "z2";
}