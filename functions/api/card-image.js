const DEFAULT_ORIGIN = 'https://cardvault-tcg.beulahsilka.chatgpt.site';

export async function onRequestGet(context) {
  const incoming = new URL(context.request.url);
  const origin = context.env.BACKEND_ORIGIN || DEFAULT_ORIGIN;
  const target = new URL('/api/card-image', origin);
  target.search = incoming.search;

  try {
    const response = await fetch(target.toString());
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    return new Response('Card image bridge is temporarily unavailable.', { status: 502 });
  }
}
