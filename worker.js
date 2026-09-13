const LEGACY_ORIGIN = 'https://cardvault-tcg.beulahsilka.chatgpt.site';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const upstream = new URL(url.pathname + url.search, LEGACY_ORIGIN);
      const headers = new Headers(request.headers);
      headers.set('host', upstream.host);

      const init = {
        method: request.method,
        headers,
        redirect: 'follow',
      };

      if (!['GET', 'HEAD'].includes(request.method)) {
        init.body = request.body;
      }

      try {
        const response = await fetch(upstream, init);
        const outHeaders = new Headers(response.headers);
        outHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: outHeaders,
        });
      } catch (error) {
        return Response.json({
          error: 'Upstream service unavailable',
          detail: String(error?.message || error),
        }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
