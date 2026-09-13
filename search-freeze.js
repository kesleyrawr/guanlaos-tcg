(() => {
  const baseFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await baseFetch(...args);
    if (url.includes('/api/prices') && document.getElementById('fixedSearchQuery')) {
      return new Response('', { status: 409 });
    }
    return response;
  };
})();
