// Selbsttest: node tests/state.test.mjs
import assert from 'node:assert';
import { onRequestGet, onRequestPost } from '../functions/api/state.js';

const kv = { state: '{"a":"1"}' };
const env = { HEALTH_KEY: 'geheim', DASHBOARD_KV: { get: async k => kv[k] ?? null, put: async (k, v) => { kv[k] = v; } } };
const req = (key, opts = {}) => ({ env, request: new Request('https://x/api/state', { ...opts, headers: key ? { 'X-Health-Key': key } : {} }) });
const post = body => onRequestPost(req('geheim', { method: 'POST', body }));
const backupKey = 'state-' + new Date().toISOString().slice(0, 10);

assert.equal((await onRequestGet(req())).status, 401);
assert.equal((await onRequestGet(req('falsch'))).status, 401);
assert.equal(await (await onRequestGet(req('geheim'))).text(), '{"a":"1"}');
assert.equal((await onRequestPost(req('', { method: 'POST', body: '{}' }))).status, 401);
assert.equal(kv.state, '{"a":"1"}');

// Nur geänderte Schlüssel: andere bleiben erhalten, null löscht
assert.equal((await post('{"b":"2"}')).status, 200);
assert.deepEqual(JSON.parse(kv.state), { a: '1', b: '2' });
assert.equal((await post('{"a":null}')).status, 200);
assert.deepEqual(JSON.parse(kv.state), { b: '2' });

// Tages-Backup = Stand vor der ersten Änderung des Tages, später nicht überschrieben
assert.equal(kv[backupKey], '{"a":"1"}');

// Kaputte Daten werden abgelehnt und ändern nichts
for (const bad of ['kein json', '[1]', '{"a":5}', 'null']) assert.equal((await post(bad)).status, 400);
assert.deepEqual(JSON.parse(kv.state), { b: '2' });

assert.equal((await onRequestGet({ env: { ...env, HEALTH_KEY: undefined }, request: new Request('https://x', { headers: { 'X-Health-Key': '' } }) })).status, 401);
console.log('ok');
