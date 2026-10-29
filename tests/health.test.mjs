// Selbsttest: node tests/health.test.mjs
import assert from 'node:assert';
import { onRequestPost, fromSamples, onRequestGet, openValues } from '../functions/api/health.js';

let stored = JSON.stringify({
  health: JSON.stringify([{ date: '2026-10-26', bpSys: '120', steps: '5000' }]),
  habits: JSON.stringify([{ id: 7, name: '12.000 Schritte' }]),
  theme_other: 'x',
});
const env = { HEALTH_KEY: 'geheim', DASHBOARD_KV: { get: async () => stored, put: async (k, v) => { stored = v; } } };
const post = (body, key = 'geheim') => onRequestPost({ env, request: new Request('https://x/api/health',
  { method: 'POST', headers: { 'X-Health-Key': key }, body: JSON.stringify(body) }) });

assert.equal((await post({ date: '2026-10-26', steps: 1 }, 'falsch')).status, 401);
assert.equal((await post({ date: 'gestern', steps: 9000 })).status, 400);

const res = await post([
  { date: '2026-10-26', steps: 13250.4, sleepMin: 0, rhr: '' },
  { date: '2026-10-27', sleepMin: '452', deepMin: 88, remMin: '97,6', hrv: 999 },
]);
assert.equal(res.status, 200);
const state = JSON.parse(stored);
assert.deepEqual(JSON.parse(state.health), [
  { date: '2026-10-26', bpSys: '120', steps: '13250' },           // Blutdruck bleibt, 0/leer überschreibt nichts
  { date: '2026-10-27', sleepMin: 452, deepMin: 88, remMin: 98 }, // HRV 999 außerhalb des Bereichs verworfen
]);
assert.deepEqual(JSON.parse(state.habit_log_7), { '2026-10-26': true });
assert.equal(state.theme_other, 'x');

// Rohe Samples vom Kurzbefehl (Uhrzeiten wie von iOS formatiert, Berlin = UTC+1 im November)
const samples = [
  'sleep;Tief;Zepp;2026-10-31T22:30:00+01:00;2026-11-01T00:00:00+01:00',
  'sleep;Kern;Zepp;2026-11-01T00:00:00+01:00;2026-11-01T04:00:00+01:00',
  'sleep;REM;Zepp;2026-11-01T04:00:00+01:00;2026-11-01T05:30:00+01:00',
  'sleep;Wach;Zepp;2026-11-01T05:30:00+01:00;2026-11-01T05:45:00+01:00',      // wach zählt nicht
  'sleep;Kern;Zepp;2026-10-30T23:00:00+01:00;2026-10-31T06:00:00+01:00',      // Nacht davor: raus
  'sleep;Im Bett;iPhone;2026-10-31T22:00:00+01:00;2026-11-01T06:00:00+01:00', // nur "im Bett": raus
  'steps;800;iPhone;2026-10-31T09:00:00+01:00;2026-10-31T10:00:00+01:00',
  'steps;1.200;Zepp;2026-10-31T09:00:00+01:00;2026-10-31T10:00:00+01:00',     // Quelle mit mehr Schritten gewinnt
  'steps;300;Zepp;2026-10-31T23:30:00+01:00;2026-10-31T23:59:00+01:00',
  'steps;5000;Zepp;2026-11-01T06:00:00+01:00;2026-11-01T07:00:00+01:00',     // heute (unvollständig): raus
  'steps;7000;Zepp;2026-10-30T11:00:00+01:00;2026-10-30T12:00:00+01:00',     // vorgestern: raus
  'kaputt',
].join('\n');
assert.deepEqual(fromSamples(samples, new Date('2026-11-01T07:00:00+01:00')), [
  { date: '2026-10-31', steps: 1500 },
  { date: '2026-11-01', sleepMin: 420, deepMin: 90, remMin: 90 },
]);
// Ruhepuls = neuester Wert, HRV = Mittel der Messungen vom Tag der neuesten; Dezimalkomma erlaubt
assert.deepEqual(fromSamples([
  'rhr;61;Zepp;2026-10-31T08:00:00+01:00;2026-10-31T08:00:00+01:00',
  'rhr;58;Zepp;2026-11-01T07:00:00+01:00;2026-11-01T07:00:00+01:00',
  'hrv;40,5;Zepp;2026-10-31T03:00:00+01:00;2026-10-31T03:00:00+01:00',
  'hrv;44;Zepp;2026-11-01T02:00:00+01:00;2026-11-01T02:00:00+01:00',
  'hrv;50;Zepp;2026-11-01T04:00:00+01:00;2026-11-01T04:00:00+01:00',
].join('\n'), new Date('2026-11-01T12:00:00+01:00')), [
  { date: '2026-11-01', rhr: 58 },
  { date: '2026-11-01', hrv: 47 },
]);
// Ohne Schlafphasen zählen die "Schlafend"-Abschnitte; Tief/REM bleiben leer statt 0
assert.deepEqual(fromSamples('sleep;Schlafend;Zepp;2026-11-01T00:00:00+01:00;2026-11-01T07:00:00+01:00', new Date('2026-11-01T12:00:00+01:00')),
  [{ date: '2026-11-01', sleepMin: 420, deepMin: 0, remMin: 0 }]);
assert.equal((await post({ samples: 'sleep;Schlafend;Zepp;2026-11-01T00:00:00+01:00;2026-11-01T07:00:00+01:00' })).status, 200);
assert.equal(JSON.parse(JSON.parse(stored).health).find(d => d.date === '2026-11-01').deepMin, undefined);
assert.deepEqual(fromSamples('steps;100;Zepp;2026-03-29T10:00:00+02:00;2026-03-29T11:00:00+02:00', new Date('2026-03-30T00:30:00+02:00')),
  [{ date: '2026-03-29', steps: 100 }]); // Zeitumstellung verschiebt "gestern" nicht
const now = new Date('2026-10-28T20:00:00+01:00');
const st = (health, extra = {}) => ({ health: JSON.stringify(health), ...extra });
assert.equal(openValues(st([{ date: '2026-10-28', bpSys: '120', temp: '36.5' }], {
  'sprachtrainer-en-v1': JSON.stringify({ days: { '2026-10-28': { n: 12 } } }) }), now), 'Offen: Meditation, Vokabeln (12/20), Sport');
assert.equal(openValues(st([{ date: '2026-10-28', bpSys: '120', temp: '36.5', medit: '10' }], {
  'sprachtrainer-en-v1': JSON.stringify({ days: { '2026-10-28': { n: 20 } } }),
  sport_cardio: JSON.stringify([{ date: '2026-10-28', min: 30 }]) }), now), 'Alles erledigt ✓');
assert.equal(openValues({}, now), 'Offen: Blutdruck, Temperatur, Meditation, Vokabeln (0/20), Sport');
assert.equal((await onRequestGet({ env, request: new Request('https://x/api/health') })).status, 401);
assert.match(await (await onRequestGet({ env, request: new Request('https://x/api/health', { headers: { 'X-Health-Key': 'geheim' } }) })).text(), /^(Offen|Alles)/);
console.log('ok');
