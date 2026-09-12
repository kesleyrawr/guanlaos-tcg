const DEFAULT_ORIGIN = 'https://cardvault-tcg.beulahsilka.chatgpt.site';

export async function onRequestPost(context) {
  const origin = context.env.BACKEND_ORIGIN || DEFAULT_ORIGIN;
  const target = new URL('/api/prices', origin);

  try {
    const payload = await context.request.text();
    const response = await fetch(target.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: payload
    });
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  } catch (error) {
    return Response.json({ quotes: {}, message: 'Price service bridge is temporarily unavailable.' }, { status: 502 });
  }
}
