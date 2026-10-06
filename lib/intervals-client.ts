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
        type: "Ride",
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
