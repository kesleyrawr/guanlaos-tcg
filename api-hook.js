(() => {
  const originalFetch = window.fetch.bind(window);
  const STORAGE_KEY = 'cardvault-v2';
  const PRICE_CACHE_KEY = 'guanlao-price-cache-v2';
  const RATE_KEY = 'guanlao-api-rate-v1';
  const RELOAD_FLAG = 'guanlao-enrich-reload';
  const CACHE_MS = 24 * 60 * 60 * 1000;
  const PRICE_BATCH = 8;
  const RESERVE = 10;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function priceCache() { return readJson(PRICE_CACHE_KEY, {}); }
  function rateState() { return readJson(RATE_KEY, null); }

  function saveRate(info, paused = false) {
    if (!info) return;
    const normalized = {
      daily_limit: Number(info.daily_limit || 100) || 100,
      daily_remaining: Number(info.daily_remaining),
      daily_reset: info.daily_reset || null,
      paused: Boolean(paused),
      savedAt: Date.now()
    };
    if (!Number.isFinite(normalized.daily_remaining)) return;
    writeJson(RATE_KEY, normalized);
    renderBudget();
  }

  function resetPassed(rate) {
    if (!rate?.daily_reset) return false;
    const t = new Date(rate.daily_reset).getTime();
    return Number.isFinite(t) && Date.now() >= t;
  }

  function shouldPause() {
    const r = rateState();
    if (!r) return false;
    if (resetPassed(r)) {
      localStorage.removeItem(RATE_KEY);
      return false;
    }
    return r.paused || Number(r.daily_remaining) <= RESERVE;
  }

  function resetText(rate) {
    if (!rate?.daily_reset) return 'tomorrow';
    try {
      return new Intl.DateTimeFormat('en-PH', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        timeZone: 'Asia/Manila'
      }).format(new Date(rate.daily_reset)) + ' PH time';
    } catch { return 'tomorrow'; }
  }

  function renderBudget() {
    if (!document.body) return;
    let box = document.getElementById('apiBudgetBar');
    if (!box) {
      box = document.createElement('div');
      box.id = 'apiBudgetBar';
      box.style.cssText = 'margin:10px 26px 0;padding:10px 14px;border:2px solid #243b78;border-radius:10px;background:#fff8da;box-shadow:3px 3px 0 #ef6b45;font:700 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#243b78;';
      const backup = document.querySelector('.backup-panel');
      if (backup?.parentNode) backup.parentNode.insertBefore(box, backup.nextSibling);
      else document.body.prepend(box);
    }

    const r = rateState();
    if (!r || resetPassed(r)) {
      box.innerHTML = '🃏 <b>Free lookup budget:</b> waiting for API status · card photos and prices are cached for 24 hours.';
      return;
    }

    const left = Math.max(0, Number(r.daily_remaining || 0));
    const limit = Number(r.daily_limit || 100);
    const paused = r.paused || left <= RESERVE;
    box.style.background = paused ? '#fff0e5' : '#fff8da';
    box.style.borderColor = paused ? '#b43d2f' : '#243b78';
    box.innerHTML = paused
      ? `⏸️ <b>Daily free lookup guard active:</b> ${left}/${limit} lookups left. Automatic price refresh is paused so you can continue tomorrow after <b>${resetText(r)}</b>. Saved cards, photos and last prices stay safe.`
      : `🃏 <b>Free API budget:</b> ${left}/${limit} lookups left today · 24-hour cache active · automatic price refresh pauses at ${RESERVE} remaining.`;
  }

  function quoteFromCard(card) {
    if (!card?.id) return null;
    const market = Number(card.market || 0);
    const low = Number(card.low || 0);
    const median = Number(card.median || 0);
    if (!(market > 0 || low > 0 || median > 0)) return null;
    return {
      market,
      low,
      median,
      marketUsd: Number(card.marketUsd || 0),
      usdPhpRate: Number(card.usdPhpRate || 0),
      source: card.priceSource || 'TCG API',
      updatedAt: card.priceUpdatedAt || new Date().toISOString(),
      checkedAt: new Date().toISOString()
    };
  }

  function cacheSearchCards(cards) {
    if (!Array.isArray(cards) || !cards.length) return;
    const cache = priceCache();
    let changed = false;
    for (const card of cards) {
      const quote = quoteFromCard(card);
      if (!quote) continue;
      cache[card.id] = {
        quote,
        update: {
          providerId: card.providerId || null,
          image: card.image || '',
          tcgplayerUrl: card.tcgplayerUrl || '',
          priceSource: card.priceSource || quote.source,
          lastPriceCheck: new Date().toISOString()
        },
        checkedAt: Date.now()
      };
      changed = true;
    }
    if (changed) writeJson(PRICE_CACHE_KEY, cache);
  }

  function enrichStoredCards(updates = {}) {
    const cards = readJson(STORAGE_KEY, []);
    if (!Array.isArray(cards) || !cards.length) return false;
    let changed = false;
    for (const card of cards) {
      const update = updates[card.id];
      if (!update) continue;
      if (!card.image && update.image) { card.image = update.image; changed = true; }
      if (!card.providerId && update.providerId) { card.providerId = update.providerId; changed = true; }
      if (!card.tcgplayerUrl && update.tcgplayerUrl) { card.tcgplayerUrl = update.tcgplayerUrl; changed = true; }
      if (update.priceSource && card.priceSource !== update.priceSource) { card.priceSource = update.priceSource; changed = true; }
      if (update.lastPriceCheck && card.lastPriceCheck !== update.lastPriceCheck) { card.lastPriceCheck = update.lastPriceCheck; changed = true; }
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    return changed;
  }

  function synthetic(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  function parsePriceRequest(args) {
    try {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === 'string' ? input : input?.url || '';
      if (!url.includes('/api/prices')) return null;
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      if (!body || !Array.isArray(body.cards)) return null;
      return { input, init, body };
    } catch { return null; }
  }

  function cachedBundle(cards) {
    const cache = priceCache();
    const quotes = {};
    const updates = {};
    const stale = [];
    const now = Date.now();

    for (const card of cards) {
      const entry = cache[card.id];
      if (entry?.quote) quotes[card.id] = entry.quote;
      if (entry?.update) updates[card.id] = entry.update;
      if (!entry || !entry.checkedAt || now - Number(entry.checkedAt) >= CACHE_MS) stale.push(card);
    }
    return { cache, quotes, updates, stale };
  }

  window.fetch = async (...args) => {
    const priceReq = parsePriceRequest(args);
    if (priceReq) {
      const allCards = priceReq.body.cards;
      const bundle = cachedBundle(allCards);

      if (shouldPause() || !bundle.stale.length) {
        const r = rateState();
        return synthetic({
          quotes: bundle.quotes,
          updates: bundle.updates,
          rateLimit: r,
          paused: shouldPause(),
          cached: true,
          message: shouldPause() ? 'Daily free lookup guard active. Continue tomorrow.' : null
        });
      }

      const selected = bundle.stale.slice(0, PRICE_BATCH);
      const nextInit = { ...priceReq.init, body: JSON.stringify({ ...priceReq.body, cards: selected }) };
      const response = await originalFetch(priceReq.input, nextInit);

      let data = {};
      try { data = await response.clone().json(); } catch {}

      if (data?.rateLimit) saveRate(data.rateLimit, Boolean(data.paused));
      if (response.status === 429) {
        if (data?.rateLimit) saveRate(data.rateLimit, true);
        return synthetic({
          quotes: bundle.quotes,
          updates: bundle.updates,
          rateLimit: data?.rateLimit || rateState(),
          paused: true,
          message: data?.message || 'Daily free lookup limit reached. Continue tomorrow.'
        });
      }

      const cache = bundle.cache;
      const now = Date.now();
      for (const card of selected) {
        const quote = data?.quotes?.[card.id];
        const update = data?.updates?.[card.id];
        if (!quote && !update) continue;
        cache[card.id] = {
          quote: quote || cache[card.id]?.quote || null,
          update: update || cache[card.id]?.update || null,
          checkedAt: now
        };
      }
      writeJson(PRICE_CACHE_KEY, cache);
      enrichStoredCards(data?.updates || {});

      const merged = cachedBundle(allCards);
      return synthetic({
        ...data,
        quotes: { ...merged.quotes, ...(data?.quotes || {}) },
        updates: { ...merged.updates, ...(data?.updates || {}) },
        cached: false
      }, response.ok ? 200 : response.status);
    }

    const response = await originalFetch(...args);

    try {
      const input = args[0];
      const requestUrl = typeof input === 'string' ? input : input?.url || '';
      if (!requestUrl.includes('/api/card-search')) return response;

      const data = await response.clone().json();
      if (data?.rateLimit) saveRate(data.rateLimit, Boolean(data.paused));
      if (response.status === 429 || data?.paused) {
        if (data?.rateLimit) saveRate(data.rateLimit, true);
        return response;
      }
      cacheSearchCards(data?.cards || []);
    } catch {
      // Never interfere with the main app if caching fails.
    }

    return response;
  };

  document.addEventListener('click', event => {
    const add = event.target?.closest?.('#addCard');
    if (!add) return;
    setTimeout(() => {
      const flag = sessionStorage.getItem(RELOAD_FLAG);
      if (!flag) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        location.reload();
      }
    }, 300);
  });

  window.addEventListener('load', () => {
    sessionStorage.removeItem(RELOAD_FLAG);
    renderBudget();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBudget);
  else renderBudget();
})();
