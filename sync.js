// Abgleich je localStorage-Schlüssel statt ganzer Stand: gesendet wird nur, was sich seit dem
// letzten Abgleich geändert hat, und beim Abholen bleiben eigene ungesendete Änderungen erhalten.
// sync_base merkt sich je Schlüssel eine Prüfsumme des zuletzt abgeglichenen Werts.
const SYNC_LOCAL_ONLY = ['theme', 'sync_key', 'sync_base']; // rein lokal, nicht syncen

const syncHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) | 0; return s.length + ':' + h; };
const readSyncBase = store => { try { return JSON.parse(store.getItem('sync_base')) || {}; } catch (e) { return {}; } };

// Seit dem letzten Abgleich geänderte Schlüssel; null = lokal gelöscht
function syncChanges(store, base) {
  const changes = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (SYNC_LOCAL_ONLY.includes(k)) continue;
    const v = store.getItem(k);
    if (base[k] !== syncHash(v)) changes[k] = v;
  }
  for (const k in base) if (store.getItem(k) === null) changes[k] = null;
  return changes;
}

// Nach erfolgreichem Senden: gesendete Werte gelten als abgeglichen (frisch gelesen, falls zwischendurch abgeholt wurde)
function syncMarkSent(store, changes) {
  const base = readSyncBase(store);
  for (const [k, v] of Object.entries(changes)) v === null ? delete base[k] : base[k] = syncHash(v);
  store.setItem('sync_base', JSON.stringify(base));
}

// Cloud-Stand übernehmen, außer für eigene ungesendete Änderungen. Gibt zurück, ob noch etwas zu senden ist.
function syncApplyPull(store, data) {
  const first = store.getItem('sync_base') === null; // erstes Mal auf diesem Gerät: Cloud gewinnt wie bisher
  const base = readSyncBase(store);
  const dirty = first ? {} : syncChanges(store, base);
  for (const [k, v] of Object.entries(data)) {
    if (k in dirty || SYNC_LOCAL_ONLY.includes(k) || typeof v !== 'string') continue;
    store.setItem(k, v);
    base[k] = syncHash(v);
  }
  // Auf einem anderen Gerät gelöscht: war schon abgeglichen, fehlt jetzt in der Cloud.
  // Leere Antwort nie als „alles gelöscht“ werten.
  if (Object.keys(data).length) for (const k in base) if (!(k in data) && !(k in dirty)) { store.removeItem(k); delete base[k]; }
  store.setItem('sync_base', JSON.stringify(base));
  return Object.keys(syncChanges(store, base)).length > 0;
}
