(() => {
  const originalFetch = window.fetch.bind(window);
  const STORAGE_KEY = 'cardvault-v2';
  const RELOAD_FLAG = 'guanlao-enrich-reload';

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    try {
      const input = args[0];
      const requestUrl = typeof input === 'string' ? input : input?.url || '';
      if (!requestUrl.includes('/api/prices') || !response.ok) return response;

      const data = await response.clone().json();
      const updates = data?.updates || {};
      const cards = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(cards) || !cards.length) return response;

      let changed = false;
      for (const card of cards) {
        const update = updates[card.id];
        if (!update) continue;
        if (!card.image && update.image) {
          card.image = update.image;
          changed = true;
        }
        if (!card.providerId && update.providerId) {
          card.providerId = update.providerId;
          changed = true;
        }
        if (!card.tcgplayerUrl && update.tcgplayerUrl) {
          card.tcgplayerUrl = update.tcgplayerUrl;
          changed = true;
        }
        if (update.priceSource && card.priceSource !== update.priceSource) {
          card.priceSource = update.priceSource;
          changed = true;
        }
      }

      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          setTimeout(() => location.reload(), 150);
        }
      } else {
        sessionStorage.removeItem(RELOAD_FLAG);
      }
    } catch {
      // Never interfere with the main app if enrichment fails.
    }

    return response;
  };
})();
