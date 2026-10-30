// Ganzer Dashboard-Stand – nur mit Schlüssel (derselbe HEALTH_KEY wie beim Health-Kurzbefehl)
const allowed = ({ request, env }) => env.HEALTH_KEY && request.headers.get('X-Health-Key') === env.HEALTH_KEY;
const denied = () => new Response('Nicht autorisiert', { status: 401 });

export async function onRequestGet(context) {
  if (!allowed(context)) return denied();
  const data = await context.env.DASHBOARD_KV.get('state');
  return new Response(data || '{}', {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  if (!allowed(context)) return denied();
  const body = await context.request.text();
  await context.env.DASHBOARD_KV.put('state', body);
  return new Response('OK', { headers: { 'Content-Type': 'text/plain' } });
}
