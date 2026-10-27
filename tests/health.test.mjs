// Selbsttest: node tests/health.test.mjs
import assert from 'node:assert';
import { onRequestPost } from '../functions/api/health.js';

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
console.log('ok');
