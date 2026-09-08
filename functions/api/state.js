export async function onRequestGet(context) {
  const data = await context.env.DASHBOARD_KV.get('state');
  return new Response(data || '{}', {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const body = await context.request.text();
  await context.env.DASHBOARD_KV.put('state', body);
  return new Response('OK', { headers: { 'Content-Type': 'text/plain' } });
}
