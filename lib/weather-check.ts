// npx tsx lib/weather-check.ts — pruebas de las partes puras del clima (sin red ni base de datos)
import { aggregateHourly, toDegrees } from "./weather";

const problems: string[] = [];
const eq = (name: string, got: unknown, want: unknown) => { if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); };
const near = (name: string, got: number | null, want: number, tol = 0.01) => { if (got == null || Math.abs(got - want) > tol) problems.push(`${name}: ${got} ≠ ${want}`); };

// semicírculos → grados (Buenos Aires ≈ -34.6, -58.4) y grados que ya vienen en grados
near("semicírculos lat", toDegrees(Math.round((-34.6 * 2147483648) / 180)), -34.6, 1e-4);
near("semicírculos lon", toDegrees(Math.round((-58.4 * 2147483648) / 180)), -58.4, 1e-4);
eq("grados quedan igual", toDegrees(-34.6), -34.6);

// Salida de 15:48 a 18:11 (hora local guardada como UTC): cubre las horas 15, 16, 17 y 18
const time = ["2026-10-06T14:00", "2026-10-06T15:00", "2026-10-06T16:00", "2026-10-06T17:00", "2026-10-06T18:00", "2026-10-06T19:00"];
const h = {
  time,
  temperature_2m: [15, 18, 20, 22, 21, 19],
  apparent_temperature: [14, 17, 20, 23, 21, 18],
  wind_speed_10m: [10, 10, 14, 18, 12, 8],
  wind_gusts_10m: [20, 20, 30, 38, 25, 15],
  wind_direction_10m: [350, 350, 10, 350, 10, 0],
  precipitation: [0, 0, 0, 0.4, 0, 0],
  cloud_cover: [10, 20, 40, 60, 80, 90],
};
const w = aggregateHourly(h, new Date("2026-10-06T15:48:23.000Z"), 8607);
if (!w) problems.push("aggregateHourly devolvió null");
else {
  near("temp media", w.temp, (18 + 20 + 22 + 21) / 4);
  eq("temp mín/máx", [w.tempMin, w.tempMax], [18, 22]);
  near("viento medio", w.windKmh, (10 + 14 + 18 + 12) / 4);
  eq("ráfaga máx", w.gustKmh, 38);
  eq("lluvia máx", w.rain, 0.4);
  if (w.windDeg == null || !(w.windDeg >= 355 || w.windDeg <= 5)) problems.push(`dirección del viento ${w.windDeg} debería ser ~0° (norte)`);
}
eq("sin horas que coincidan", aggregateHourly(h, new Date("2026-10-07T10:00:00.000Z"), 3600), null);

console.log({ problems: problems.length });
if (problems.length) { console.log(problems); process.exit(1); }
