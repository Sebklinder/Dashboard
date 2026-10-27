// Selbsttest: node tests/health.test.mjs
import assert from 'node:assert';
import { onRequestPost, fromSamples } from '../functions/api/health.js';

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
  'steps;800;iPhone;2026-11-01T09:00:00+01:00;2026-11-01T10:00:00+01:00',
  'steps;1.200;Zepp;2026-11-01T09:00:00+01:00;2026-11-01T10:00:00+01:00',     // Quelle mit mehr Schritten gewinnt
  'steps;300;Zepp;2026-11-01T11:00:00+01:00;2026-11-01T11:30:00+01:00',
  'steps;5000;Zepp;2026-10-31T11:00:00+01:00;2026-10-31T12:00:00+01:00',     // gestern: raus
  'kaputt',
].join('\n');
assert.deepEqual(fromSamples(samples, new Date('2026-11-01T12:00:00+01:00')), [
  { date: '2026-11-01', steps: 1500 },
  { date: '2026-11-01', sleepMin: 420, deepMin: 90, remMin: 90 },
]);
// Ohne Schlafphasen zählen die "Schlafend"-Abschnitte; Tief/REM bleiben leer statt 0
assert.deepEqual(fromSamples('sleep;Schlafend;Zepp;2026-11-01T00:00:00+01:00;2026-11-01T07:00:00+01:00', new Date('2026-11-01T12:00:00+01:00')),
  [{ date: '2026-11-01', sleepMin: 420, deepMin: 0, remMin: 0 }]);
assert.equal((await post({ samples: 'sleep;Schlafend;Zepp;2026-11-01T00:00:00+01:00;2026-11-01T07:00:00+01:00' })).status, 200);
assert.equal(JSON.parse(JSON.parse(stored).health).find(d => d.date === '2026-11-01').deepMin, undefined);
console.log('ok');
