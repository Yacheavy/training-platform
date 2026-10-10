const INTERVALS_BASE_URL = "https://intervals.icu/api/v1";

function authHeader(apiKey: string): string {
  // Intervals.icu usa HTTP Basic Auth con usuario literal "API_KEY"
  // y la key como password
  const encoded = Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  return `Basic ${encoded}`;
}

export async function getActivities(
  athleteId: string,
  apiKey: string,
  oldest: string, // formato "YYYY-MM-DD"
  newest: string
) {
  const url = `${INTERVALS_BASE_URL}/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(apiKey) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Intervals API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getWellness(
  athleteId: string,
  apiKey: string,
  oldest: string,
  newest: string
) {
  const url = `${INTERVALS_BASE_URL}/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(apiKey) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Intervals API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
export interface IntervalsEventInput {
  external_id: string;
  name: string;
  startDateLocal: string; // "YYYY-MM-DDTHH:mm:ss"
  description: string;
  movingTimeSec: number;
  /** Tipo de actividad de Intervals (por defecto "Ride"). */
  type?: string;
}

/**
 * Crea o ACTUALIZA el evento (por external_id) con el endpoint masivo con upsert=true.
 * (El endpoint individual con upsertOnUid solo hace upsert por `uid`, que no enviamos:
 * cada envío creaba un evento nuevo y el viejo quedaba con la descripción anterior.)
 * Después borra, en ese mismo día, los eventos duplicados que tengan el mismo external_id.
 */
export async function createEvent(athleteId: string, apiKey: string, event: IntervalsEventInput) {
  const base = `${INTERVALS_BASE_URL}/athlete/${athleteId}`;
  const res = await fetch(`${base}/events/bulk?upsert=true`, {
    method: "POST",
    headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        external_id: event.external_id,
        category: "WORKOUT",
        start_date_local: event.startDateLocal,
        name: event.name,
        type: event.type ?? "Ride",
        moving_time: event.movingTimeSec,
        description: event.description,
      },
    ]),
  });
  if (!res.ok) {
    throw new Error(`Intervals API error: ${res.status} ${await res.text()}`);
  }
  const saved = (await res.json().catch(() => null)) as { id?: number }[] | null;
  const keepId = Array.isArray(saved) ? saved[0]?.id : undefined;

  // Limpieza de duplicados del mismo día (de envíos anteriores). Es opcional: nunca rompe el envío.
  try {
    const day = event.startDateLocal.slice(0, 10);
    const list = await fetch(`${base}/events?oldest=${day}&newest=${day}&category=WORKOUT`, {
      headers: { Authorization: authHeader(apiKey) },
      cache: "no-store",
    });
    if (list.ok && keepId != null) {
      const events = (await list.json()) as { id: number; external_id?: string | null }[];
      for (const e of events) {
        if (e.external_id === event.external_id && e.id !== keepId) {
          await fetch(`${base}/events/${e.id}`, { method: "DELETE", headers: { Authorization: authHeader(apiKey) } });
        }
      }
    }
  } catch (err) {
    console.error("Limpieza de duplicados en Intervals falló:", err);
  }
  return saved;
}

export async function getPowerCurve(athleteId: string, apiKey: string, curves = "90d", type = "Ride") {
  const url = `${INTERVALS_BASE_URL}/athlete/${athleteId}/power-curves?curves=${encodeURIComponent(curves)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, { headers: { Authorization: authHeader(apiKey) }, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Intervals API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getSportSettings(athleteId: string, apiKey: string) {
  const url = `${INTERVALS_BASE_URL}/athlete/${athleteId}/sport-settings`;
  const res = await fetch(url, { headers: { Authorization: authHeader(apiKey) }, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Intervals API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}


/** Archivo original de la actividad (FIT) tal como lo subió el dispositivo; null si Intervals no lo guarda (ej. actividades que vienen de Strava). */
export async function getActivityFile(apiKey: string, activityId: string): Promise<Buffer | null> {
  const res = await fetch(`${INTERVALS_BASE_URL}/activity/${activityId}/file`, { headers: { Authorization: authHeader(apiKey) }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (res.status === 404 || res.status === 403 || res.status === 422) return null;
  if (!res.ok) throw new Error(`Intervals API error: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Actividad con los intervalos que detectó Intervals.icu (icu_intervals). */
export async function getActivityWithIntervals(apiKey: string, activityId: string) {
  const res = await fetch(`${INTERVALS_BASE_URL}/activity/${activityId}?intervals=true`, { headers: { Authorization: authHeader(apiKey) }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Intervals API error: ${res.status}`);
  return res.json();
}

/**
 * Envía el RPE (1–10) y la sensación (1–5, 1 = fuerte) a la actividad en Intervals.icu.
 * Verifica que Intervals haya tomado los valores (la respuesta trae la actividad actualizada).
 */
export async function updateActivityRatings(apiKey: string, activityId: string, r: { rpe?: number | null; feel?: number | null }): Promise<{ ok: true } | { ok: false; reason: string }> {
  const body: Record<string, number> = {};
  if (r.rpe != null) body.icu_rpe = r.rpe;
  if (r.feel != null) body.feel = r.feel;
  if (Object.keys(body).length === 0) return { ok: true };
  const res = await fetch(`${INTERVALS_BASE_URL}/activity/${activityId}`, {
    method: "PUT",
    headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return { ok: false, reason: `Intervals respondió ${res.status}` };
  const j = (await res.json().catch(() => null)) as { icu_rpe?: number | null; feel?: number | null } | null;
  if (j) {
    if (body.icu_rpe != null && j.icu_rpe !== body.icu_rpe) return { ok: false, reason: "Intervals no tomó el RPE" };
    if (body.feel != null && j.feel !== body.feel) return { ok: false, reason: "Intervals no tomó la sensación" };
  }
  return { ok: true };
}
