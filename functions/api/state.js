// Ganzer Dashboard-Stand – nur mit Schlüssel (derselbe HEALTH_KEY wie beim Health-Kurzbefehl)
const allowed = ({ request, env }) => env.HEALTH_KEY && request.headers.get('X-Health-Key') === env.HEALTH_KEY;
const denied = () => new Response('Nicht autorisiert', { status: 401 });
const BACKUP_DAYS = 30;

export async function onRequestGet(context) {
  if (!allowed(context)) return denied();
  const data = await context.env.DASHBOARD_KV.get('state');
  return new Response(data || '{}', {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Body = geänderte Schlüssel {key: Wert als Text | null = löschen}; andere Schlüssel bleiben unberührt
export async function onRequestPost(context) {
  if (!allowed(context)) return denied();
  let changes;
  try { changes = JSON.parse(await context.request.text()); } catch (e) { changes = null; }
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)
      || Object.values(changes).some(v => v !== null && typeof v !== 'string')) {
    return new Response('Ungültige Daten', { status: 400 });
  }
  const kv = context.env.DASHBOARD_KV;
  const old = await kv.get('state') || '{}';
  // Tages-Backup vom Stand vor der ersten Änderung des Tages, zum Zurückholen per wrangler
  const backupKey = 'state-' + new Date().toISOString().slice(0, 10);
  if (!(await kv.get(backupKey))) await kv.put(backupKey, old, { expirationTtl: BACKUP_DAYS * 86400 });

  // shortcut: lesen + schreiben ohne Sperre wie in health.js – gleichzeitige Änderungen am selben Schlüssel: der letzte gewinnt
  const state = JSON.parse(old);
  for (const [k, v] of Object.entries(changes)) v === null ? delete state[k] : state[k] = v;
  await kv.put('state', JSON.stringify(state));
  return new Response('OK', { headers: { 'Content-Type': 'text/plain' } });
}
