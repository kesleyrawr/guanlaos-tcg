const DEFAULT_ORIGIN = 'https://cardvault-tcg.beulahsilka.chatgpt.site';

export async function onRequestGet(context) {
  const incoming = new URL(context.request.url);
  const origin = context.env.BACKEND_ORIGIN || DEFAULT_ORIGIN;
  const target = new URL('/api/card-search', origin);
  target.search = incoming.search;

  try {
    const response = await fetch(target.toString(), {
      headers: { 'Accept': 'application/json' }
    });
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60'
      }
    });
  } catch (error) {
    return Response.json({ cards: [], message: 'Card catalog bridge is temporarily unavailable.' }, { status: 502 });
  }
}
