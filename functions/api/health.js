// Nimmt Gesundheitswerte vom iPhone-Kurzbefehl (Apple Health ← Zepp) entgegen
// und merged sie in den gespeicherten Dashboard-Stand, Schlüssel 'health'.
// Body: ein Eintrag oder eine Liste, z. B. [{ "date": "2026-10-27", "sleepMin": 452, "steps": 9800 }]

// Feld → [min, max, als Zahl speichern?] – Typen wie bei der Handeingabe in index.html
const FIELDS = {
  sleepMin: [60, 960, true],
  deepMin: [0, 600, true],
  remMin: [0, 600, true],
  steps: [1, 100000, false],
  rhr: [30, 120, false],
  hrv: [5, 250, false],
};

export function mergeHealth(health, entries) {
  const saved = [];
  for (const raw of entries) {
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) continue;
    const fields = {};
    for (const [k, [min, max, asNum]] of Object.entries(FIELDS)) {
      const n = Math.round(parseFloat(String(raw[k] ?? '').replace(',', '.')));
      // 0 / leer heißt "keine Daten" (z. B. Uhr nachts nicht getragen) – nichts überschreiben
      if (n >= min && n <= max) fields[k] = asNum ? n : String(n);
    }
    if (!Object.keys(fields).length) continue;
    const idx = health.findIndex(d => d.date === raw.date);
    if (idx >= 0) health[idx] = { ...health[idx], ...fields };
    else health.push({ date: raw.date, ...fields });
    saved.push({ date: raw.date, ...fields });
  }
  health.sort((a, b) => a.date.localeCompare(b.date));
  return saved;
}

// Wie checkStepsHabit() in index.html: ab 12.000 Schritten das Schritte-Habit abhaken
function tickStepsHabit(state, saved) {
  let habits = [];
  try { habits = JSON.parse(state.habits) || []; } catch (e) {}
  const habit = habits.find(h => /schritt|steps/i.test(h.name));
  if (!habit) return;
  const key = 'habit_log_' + habit.id;
  let log = {};
  try { log = JSON.parse(state[key]) || {}; } catch (e) {}
  saved.filter(e => +e.steps >= 12000).forEach(e => { log[e.date] = true; });
  state[key] = JSON.stringify(log);
}

// Kurzbefehl ohne Datum: Schlaf/Puls/HRV gehören zu heute, Schritte (stepsYesterday) zu gestern –
// so muss der Kurzbefehl keine Daten formatieren
export function withoutDate(body, now = new Date()) {
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const d = new Date(today + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const { stepsYesterday, ...rest } = body;
  return [{ ...rest, date: today }, { date: d.toISOString().slice(0, 10), steps: stepsYesterday }];
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.HEALTH_KEY || request.headers.get('X-Health-Key') !== env.HEALTH_KEY) {
    return new Response('Nicht autorisiert', { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch (e) {
    return new Response('Ungültiges JSON', { status: 400 });
  }
  const entries = Array.isArray(body) ? body : body.date ? [body] : withoutDate(body);

  // shortcut: liest/schreibt den ganzen Stand ohne Sperre – ein Gerät, das genau
  // gleichzeitig synchronisiert, kann den Import überschreiben; bei Problemen auf D1 umstellen
  const state = JSON.parse(await env.DASHBOARD_KV.get('state') || '{}');
  let health = [];
  try { health = JSON.parse(state.health) || []; } catch (e) {}
  const saved = mergeHealth(health, entries);
  if (!saved.length) return new Response('Keine gültigen Werte', { status: 400 });

  state.health = JSON.stringify(health);
  tickStepsHabit(state, saved);
  await env.DASHBOARD_KV.put('state', JSON.stringify(state));
  return new Response(JSON.stringify({ saved }), { headers: { 'Content-Type': 'application/json' } });
}
