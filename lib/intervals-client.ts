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
  });
  if (!res.ok) {
    throw new Error(`Intervals API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
export async function createEvent(
  athleteId: string,
  apiKey: string,
  event: {
    external_id: string;
    name: string;
    startDateLocal: string; // "YYYY-MM-DDTHH:mm:ss"
    description: string;
    movingTimeSec: number;
  }
) {
  const url = `${INTERVALS_BASE_URL}/athlete/${athleteId}/events?upsertOnUid=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: event.external_id,
      category: "WORKOUT",
      start_date_local: event.startDateLocal,
      name: event.name,
      type: "Ride",
      moving_time: event.movingTimeSec,
      description: event.description,
    }),
  });
  if (!res.ok) {
    throw new Error(`Intervals API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}