// Selbsttest: node tests/state.test.mjs
import assert from 'node:assert';
import { onRequestGet, onRequestPost } from '../functions/api/state.js';

let stored = '{"a":"1"}';
const env = { HEALTH_KEY: 'geheim', DASHBOARD_KV: { get: async () => stored, put: async (k, v) => { stored = v; } } };
const req = (key, opts = {}) => ({ env, request: new Request('https://x/api/state', { ...opts, headers: key ? { 'X-Health-Key': key } : {} }) });

assert.equal((await onRequestGet(req())).status, 401);
assert.equal((await onRequestGet(req('falsch'))).status, 401);
assert.equal(await (await onRequestGet(req('geheim'))).text(), '{"a":"1"}');
assert.equal((await onRequestPost(req('', { method: 'POST', body: '{}' }))).status, 401);
assert.equal(stored, '{"a":"1"}');
assert.equal((await onRequestPost(req('geheim', { method: 'POST', body: '{"b":"2"}' }))).status, 200);
assert.equal(stored, '{"b":"2"}');
assert.equal((await onRequestGet({ env: { ...env, HEALTH_KEY: undefined }, request: new Request('https://x', { headers: { 'X-Health-Key': '' } }) })).status, 401);
console.log('ok');
