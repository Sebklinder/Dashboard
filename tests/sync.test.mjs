// Selbsttest: node tests/sync.test.mjs – Abgleich-Logik aus sync.js mit einem Ersatz-localStorage
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../sync.js', import.meta.url), 'utf8') + ';this.S={syncChanges,syncMarkSent,syncApplyPull,readSyncBase}', ctx);
const { syncChanges, syncMarkSent, syncApplyPull, readSyncBase } = ctx.S;

const storage = init => {
  const m = new Map(Object.entries(init));
  return { get length() { return m.size; }, key: i => [...m.keys()][i] ?? null, getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), all: () => Object.fromEntries(m) };
};
const changes = s => JSON.parse(JSON.stringify(syncChanges(s, readSyncBase(s))));

// Erstes Mal auf dem Gerät: Cloud gewinnt, nur rein lokale Schlüssel bleiben zu senden
const s = storage({ journal: 'alt', nurLokal: 'x', theme: 'light' });
assert.equal(syncApplyPull(s, { journal: 'cloud', habits: 'h' }), true);
assert.equal(s.getItem('journal'), 'cloud');
assert.deepEqual(changes(s), { nurLokal: 'x' }); // theme wird nie gesendet
syncMarkSent(s, { nurLokal: 'x' });
assert.deepEqual(changes(s), {});

// Offline geändert, dann abgeholt: eigene Änderung bleibt, Rest kommt aus der Cloud
s.setItem('journal', 'offline-eintrag');
assert.equal(syncApplyPull(s, { journal: 'cloud', habits: 'h-neu', nurLokal: 'x' }), true);
assert.equal(s.getItem('journal'), 'offline-eintrag');
assert.equal(s.getItem('habits'), 'h-neu');
assert.deepEqual(changes(s), { journal: 'offline-eintrag' }); // veralteter Tab schickt nur, was er selbst geändert hat

// Lokal gelöscht → null senden, nicht aus der Cloud zurückholen
syncMarkSent(s, { journal: 'offline-eintrag' });
s.removeItem('habits');
syncApplyPull(s, { journal: 'offline-eintrag', habits: 'h-neu', nurLokal: 'x' });
assert.equal(s.getItem('habits'), null);
assert.deepEqual(changes(s), { habits: null });
syncMarkSent(s, { habits: null });

// Auf anderem Gerät gelöscht → hier auch weg; leere Antwort löscht nie alles
syncApplyPull(s, { journal: 'offline-eintrag' });
assert.equal(s.getItem('nurLokal'), null);
assert.equal(syncApplyPull(s, {}), false);
assert.equal(s.getItem('journal'), 'offline-eintrag');
console.log('ok');
