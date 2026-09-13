(() => {
  const baseFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || '';
    const isPriceRefresh = url.includes('/api/prices');

    const response = await baseFetch(...args);

    // app.js calls render() after a successful /api/prices response.
    // While the Card Search view is open, that would replace the live input
    // element and interrupt typing. Return a non-success copy only to the
    // background price-refresh caller so app.js leaves the Search DOM alone.
    if (isPriceRefresh && document.getElementById('searchQuery')) {
      let body = '';
      try { body = await response.clone().text(); } catch {}
      return new Response(body, {
        status: 409,
        headers: {
          'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }

    return response;
  };
})();
