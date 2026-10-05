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
  // Viene directo de un campo Json de Prisma (JsonValue), así que aceptamos
  // unknown y lo interpretamos nosotros — más robusto que pelear con el
  // tipo exacto en cada call site que pasa un registro completo de Activity.
  rawStreamsJson?: unknown;
}): string {
  if (activity.type === "WeightTraining") return "gym";
  if (activity.type !== "Ride") return "other";

  const rawStreams = activity.rawStreamsJson as { zoneTimes?: ZoneTime[] } | null | undefined;
  const zoneTimes = rawStreams?.zoneTimes;

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

      // Minutos absolutos en Z5+: un fondo largo con 8 min de VO2max sigue
      // siendo un estímulo de VO2max aunque el % sea bajo; lo evaluamos
      // antes de la regla de "mayormente Z1+Z2".
      const highMinutes =
        zoneTimes
          .filter((z) => ["Z5", "Z6", "Z7"].includes(z.id))
          .reduce((s, z) => s + z.secs, 0) / 60;

      if (pctZ1 + pctZ2 > 75 && highMinutes < 6) return "z2";

      if (pctHighIntensity > 8 || highMinutes >= 6) {
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
  // Último recurso (heurística): solo IF muy alto implica intensidad real
  if (ifValue >= 90) return "hiit_genuino";
  if (ifValue >= 80) return "umbral";
  if (ifValue >= 70) return "sweet_spot";
  return "z2";
}