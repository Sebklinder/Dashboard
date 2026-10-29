// Nimmt Gesundheitswerte vom iPhone-Kurzbefehl (Apple Health ← Zepp) entgegen
// und merged sie in den gespeicherten Dashboard-Stand, Schlüssel 'health'.
// Body: ein Eintrag oder eine Liste, z. B. [{ "date": "2026-10-27", "sleepMin": 452, "steps": 9800 }]

// Feld → [min, max, als Zahl speichern?] – Typen wie bei der Handeingabe in index.html
const FIELDS = {
  sleepMin: [60, 960, true],
  deepMin: [1, 600, true],
  remMin: [1, 600, true],
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

const berlinDate = d => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

// Der Kurzbefehl schickt rohe Health-Samples, eine Zeile je Sample: "art;wert;quelle;start;ende".
// Gerechnet wird hier, damit der Kurzbefehl ohne heikle Filter auskommt. Pro Wert zählt nur die
// Quelle mit den meisten Daten – sonst kämen iPhone- und Uhr-Schritte doppelt.
export function fromSamples(text, now = new Date()) {
  const rows = String(text).split('\n').map(l => l.split(';').map(s => s.trim()))
    .map(([kind, value, source, start, end]) => ({ kind, value, source, start: new Date(start), end: new Date(end) }))
    .filter(r => !isNaN(r.start) && !isNaN(r.end));
  const bySource = (list, amount) => {
    const sums = {};
    list.forEach(r => { sums[r.source] = (sums[r.source] || 0) + amount(r); });
    const best = Object.keys(sums).sort((a, b) => sums[b] - sums[a])[0];
    return list.filter(r => r.source === best);
  };
  const entries = [];

  // Ein Lauf am Morgen: Schritte vom ganzen gestrigen Tag (Rechnung über 12 Uhr UTC, damit Zeitumstellung nicht stört)
  const yesterday = new Date(Date.parse(berlinDate(now) + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  const count = r => parseInt(r.value.replace(/[.,\s]/g, '')) || 0; // Schritte sind ganzzahlig: "1.200" = 1200
  const steps = bySource(rows.filter(r => /step|schritt/i.test(r.kind) && berlinDate(r.start) === yesterday), count);
  if (steps.length) entries.push({ date: yesterday, steps: steps.reduce((s, r) => s + count(r), 0) });

  const mins = r => (r.end - r.start) / 60000;
  const asleep = r => /sleep|schlaf/i.test(r.kind) && !/wach|awake|bett|bed/i.test(r.value);
  let sleep = bySource(rows.filter(asleep), mins);
  if (sleep.length) {
    // nur die letzte Nacht: alles, was höchstens 16 h vor ihrem Ende begann
    const lastEnd = Math.max(...sleep.map(r => +r.end));
    sleep = sleep.filter(r => +r.start >= lastEnd - 16 * 3600000);
    const sum = re => Math.round(sleep.filter(r => re.test(r.value)).reduce((s, r) => s + mins(r), 0));
    const deepMin = sum(/tief|deep/i), remMin = sum(/rem/i), coreMin = sum(/kern|core/i);
    // Phasen vorhanden → deren Summe, sonst die unspezifischen "Schlafend"-Abschnitte
    const sleepMin = deepMin + remMin + coreMin || sum(/./);
    entries.push({ date: berlinDate(new Date(lastEnd)), sleepMin, deepMin, remMin });
  }

  // Ruhepuls: der neueste Wert. HRV: Mittel aller Messungen vom Tag der neuesten (Zepp misst nachts mehrfach).
  const num = r => parseFloat(r.value.replace(',', '.')) || 0;
  for (const [field, re, mean] of [['rhr', /rhr|ruhe/i, false], ['hrv', /hrv/i, true]]) {
    const list = bySource(rows.filter(r => re.test(r.kind) && num(r)), () => 1);
    if (!list.length) continue;
    const day = berlinDate(new Date(Math.max(...list.map(r => +r.end))));
    const ofDay = list.filter(r => berlinDate(r.end) === day).sort((a, b) => a.end - b.end);
    const value = mean ? ofDay.reduce((s, r) => s + num(r), 0) / ofDay.length : num(ofDay[ofDay.length - 1]);
    entries.push({ date: day, [field]: value });
  }
  return entries;
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
  const entries = Array.isArray(body) ? body : body.samples ? fromSamples(body.samples) : [body];

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

// Für den Erinnerungs-Kurzbefehl: was heute noch fehlt – Handwerte, Vokabeln, Ernährung, Sport (Zepp-Werte kommen automatisch).
// Krankheit & Medikamente fehlen bewusst – die gibt es nicht jeden Tag.
const MANUAL = [['bpSys', 'Blutdruck'], ['temp', 'Temperatur'], ['medit', 'Meditation']];
const VOCAB_GOAL = 20; // wie SPRACHE_GOAL in index.html
const TRAINING_GOALS = { kraft: 120, cardio: 120 }; // Minuten je Woche, wie in index.html

// Wie parseDur() in index.html: "45" oder "45:30" (min:s)
const dur = v => String(v ?? '').includes(':')
  ? (parseInt(String(v).split(':')[0]) || 0) + (parseInt(String(v).split(':')[1]) || 0) / 60
  : parseFloat(v) || 0;

export function openValues(state, now = new Date()) {
  const day = berlinDate(now);
  const get = (key, def) => { try { return JSON.parse(state[key]) || def; } catch (e) { return def; } };
  const health = get('health', []).find(e => e.date === day) || {};
  const open = MANUAL.filter(([k]) => !health[k]).map(([, label]) => label);
  // Stand des Sprachtrainers, synct mit dem Rest des localStorage
  const n = get('sprachtrainer-en-v1', {}).days?.[day]?.n || 0;
  if (n < VOCAB_GOAL) open.push(`Vokabeln (${n}/${VOCAB_GOAL})`);

  if (!(get('ern_log', {})[day] || []).length) open.push('Mahlzeiten');
  // shortcut: Grundziel ohne den Sport-Zuschlag der App, reicht als Erinnerung
  const ml = Number(get('ern_water', {})[day]) || 0, goal = Number(get('ern_water_goal', 2500)) || 2500;
  const l = v => (v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  if (ml < goal) open.push(`Wasser (${l(ml)}/${l(goal)} l)`);

  // Sport als Wochenziel (Mo bis heute) wie trainingMinutes() in index.html: Kraft-Dauer einmal je Einheit, Schiri zählt als Ausdauer
  const monday = new Date(Date.parse(day + 'T12:00:00Z') - ((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
  const week = k => get(k, []).filter(e => e.date >= monday && e.date <= day);
  const seen = new Set();
  const kraft = week('sport_kraft').reduce((s, e) => {
    const id = e.trainingId || 'day-' + e.date;
    if (seen.has(id)) return s;
    seen.add(id);
    return s + (parseFloat(e.dauer) || 0);
  }, 0);
  const cardio = week('sport_cardio').reduce((s, e) => s + dur(e.min), 0) + week('schiri_spiele').reduce((s, g) => s + (parseFloat(g.dauer) || 0), 0);
  if (kraft < TRAINING_GOALS.kraft) open.push(`Kraft (${Math.round(kraft)}/${TRAINING_GOALS.kraft} min Woche)`);
  if (cardio < TRAINING_GOALS.cardio) open.push(`Ausdauer (${Math.round(cardio)}/${TRAINING_GOALS.cardio} min Woche)`);
  return open.length ? 'Offen: ' + open.join(', ') : 'Alles erledigt ✓';
}

export async function onRequestGet({ request, env }) {
  if (!env.HEALTH_KEY || request.headers.get('X-Health-Key') !== env.HEALTH_KEY) {
    return new Response('Nicht autorisiert', { status: 401 });
  }
  const state = JSON.parse(await env.DASHBOARD_KV.get('state') || '{}');
  return new Response(openValues(state), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
