(() => {
  const originalFetch = window.fetch.bind(window);
  const STORAGE_KEY = 'cardvault-v2';
  const PRICE_CACHE_KEY = 'guanlao-price-cache-v2';
  const RATE_KEY = 'guanlao-api-rate-v1';
  const JP_USAGE_KEY = 'guanlao-jp-usage-v1';
  const CACHE_MS = 24 * 60 * 60 * 1000;
  const PRICE_BATCH = 8;
  const RESERVE = 10;
  const JP_MONTHLY_GUARD = 180;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function priceCache() { return readJson(PRICE_CACHE_KEY, {}); }
  function rateState() {
    const s = readJson(RATE_KEY, null);
    if (!s) return null;
    const remaining = Number(s.daily_remaining);
    const age = Date.now() - Number(s.savedAt || 0);
    const invalidZero = Number.isFinite(remaining) && remaining <= 0 && !s.daily_reset;
    const staleNoReset = !s.daily_reset && age > 12 * 60 * 60 * 1000;
    if (invalidZero || staleNoReset) {
      localStorage.removeItem(RATE_KEY);
      return null;
    }
    return s;
  }
  function monthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function jpUsage() {
    const s = readJson(JP_USAGE_KEY, null);
    if (!s || s.month !== monthKey()) return { month: monthKey(), used: 0 };
    return { month: s.month, used: Number(s.used || 0) };
  }
  function addJpUsage(n = 0) {
    if (!(n > 0)) return;
    const s = jpUsage();
    s.used += Number(n || 0);
    writeJson(JP_USAGE_KEY, s);
    renderBudget();
  }
  function jpRemaining() { return Math.max(0, JP_MONTHLY_GUARD - jpUsage().used); }
  function isJapaneseOnePiece(card = {}) {
    return String(card.game || '').toLowerCase().includes('one piece') && String(card.language || '').toLowerCase() === 'japanese';
  }

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
    if (normalized.daily_remaining <= 0 && !normalized.daily_reset) {
      localStorage.removeItem(RATE_KEY);
      renderBudget();
      return;
    }
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
    if (resetPassed(r)) { localStorage.removeItem(RATE_KEY); return false; }
    return r.paused || Number(r.daily_remaining) <= RESERVE;
  }
  function resetText(rate) {
    if (!rate?.daily_reset) return 'tomorrow';
    try {
      return new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila'}).format(new Date(rate.daily_reset)) + ' PH time';
    } catch { return 'tomorrow'; }
  }

  function renderBudget() {
    if (!document.body) return;
    let box = document.getElementById('apiBudgetBar');
    if (!box) {
      box = document.createElement('div');
      box.id = 'apiBudgetBar';
      box.style.cssText = 'margin:10px 26px 0;padding:10px 14px;border:2px solid #243b78;border-radius:10px;background:#fff8da;box-shadow:3px 3px 0 #ef6b45;font:700 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#243b78;';
      const backup = document.querySelector('.backup-panel');
      if (backup?.parentNode) backup.parentNode.insertBefore(box, backup.nextSibling); else document.body.prepend(box);
    }
    const r = rateState();
    const jp = jpUsage();
    const jpLeft = jpRemaining();
    const jpPaused = jpLeft <= 0;
    let tcgText = 'TCG provider: budget status unavailable';
    if (r && !resetPassed(r)) {
      const left = Math.max(0, Number(r.daily_remaining || 0));
      const limit = Number(r.daily_limit || 100);
      tcgText = (r.paused || left <= RESERVE)
        ? `TCG daily guard: ${left}/${limit} left · resumes after ${resetText(r)}`
        : `TCG daily: ${left}/${limit} left`;
    }
    const jpText = jpPaused
      ? `JP Yuyu-Tei guard: ${jp.used}/${JP_MONTHLY_GUARD} cached calls used this month · JP lookups paused`
      : `JP Yuyu-Tei: about ${jpLeft} guarded calls left this month`;
    box.style.background = (jpPaused || shouldPause()) ? '#fff0e5' : '#fff8da';
    box.innerHTML = `🃏 <b>${tcgText}</b><br>🇯🇵 <b>${jpText}</b><br><span style="font-weight:600">Japanese One Piece lookups use Yuyu-Tei independently. 24-hour price/photo cache active.</span>`;
  }

  function quoteFromCard(card) {
    if (!card?.id) return null;
    const market = Number(card.market || 0), low = Number(card.low || 0), median = Number(card.median || 0);
    if (!(market > 0 || low > 0 || median > 0 || Number(card.priceYen || 0) > 0)) return null;
    return {
      market, low, median,
      marketUsd: Number(card.marketUsd || 0),
      usdPhpRate: Number(card.usdPhpRate || 0),
      priceYen: Number(card.priceYen || 0),
      jpyPhpRate: Number(card.jpyPhpRate || 0),
      source: card.priceSource || 'Card market source',
      updatedAt: card.priceUpdatedAt || new Date().toISOString(),
      checkedAt: new Date().toISOString()
    };
  }
  function cacheSearchCards(cards) {
    if (!Array.isArray(cards) || !cards.length) return;
    const cache = priceCache(); let changed = false;
    for (const card of cards) {
      const quote = quoteFromCard(card); if (!quote) continue;
      cache[card.id] = {
        quote,
        update: {
          providerId: card.providerId || null,
          image: card.image || '',
          tcgplayerUrl: card.tcgplayerUrl || '',
          yuyuUrl: card.yuyuUrl || '',
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
      const update = updates[card.id]; if (!update) continue;
      if (!card.image && update.image) { card.image = update.image; changed = true; }
      if (!card.providerId && update.providerId) { card.providerId = update.providerId; changed = true; }
      if (!card.tcgplayerUrl && update.tcgplayerUrl) { card.tcgplayerUrl = update.tcgplayerUrl; changed = true; }
      if (!card.yuyuUrl && update.yuyuUrl) { card.yuyuUrl = update.yuyuUrl; changed = true; }
      if (update.priceSource && card.priceSource !== update.priceSource) { card.priceSource = update.priceSource; changed = true; }
      if (update.lastPriceCheck && card.lastPriceCheck !== update.lastPriceCheck) { card.lastPriceCheck = update.lastPriceCheck; changed = true; }
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    return changed;
  }
  function synthetic(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'} });
  }
  function parsePriceRequest(args) {
    try {
      const input = args[0], init = args[1] || {};
      const url = typeof input === 'string' ? input : input?.url || '';
      if (!url.includes('/api/prices')) return null;
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      if (!body || !Array.isArray(body.cards)) return null;
      return { input, init, body };
    } catch { return null; }
  }
  function cachedBundle(cards) {
    const cache = priceCache(), quotes = {}, updates = {}, stale = [], now = Date.now();
    for (const card of cards) {
      const entry = cache[card.id];
      if (entry?.quote) quotes[card.id] = entry.quote;
      if (entry?.update) updates[card.id] = entry.update;
      const missingJpImage = isJapaneseOnePiece(card) && !card.image;
      if (missingJpImage || !entry || !entry.checkedAt || now - Number(entry.checkedAt) >= CACHE_MS) stale.push(card);
    }
    return { cache, quotes, updates, stale };
  }

  window.fetch = async (...args) => {
    const priceReq = parsePriceRequest(args);
    if (priceReq) {
      const allCards = priceReq.body.cards;
      const bundle = cachedBundle(allCards);
      let jpSlots = jpRemaining();
      const selected = [];
      for (const card of bundle.stale) {
        if (selected.length >= PRICE_BATCH) break;
        if (isJapaneseOnePiece(card)) {
          if (jpSlots <= 0) continue;
          jpSlots -= 1;
        }
        if (!isJapaneseOnePiece(card) && shouldPause()) continue;
        selected.push(card);
      }

      if (!selected.length) {
        return synthetic({ quotes: bundle.quotes, updates: bundle.updates, rateLimit: rateState(), paused: true, cached: true, message: 'Free lookup guard active. Cached photos and prices are still available.' });
      }

      const nextInit = { ...priceReq.init, body: JSON.stringify({ ...priceReq.body, cards: selected }) };
      const response = await originalFetch(priceReq.input, nextInit);
      let data = {}; try { data = await response.clone().json(); } catch {}
      if (data?.rateLimit) saveRate(data.rateLimit, Boolean(data.paused));
      if (Number(data?.jpCallCount || 0) > 0) addJpUsage(Number(data.jpCallCount));
      if (response.status === 429) {
        if (data?.rateLimit) saveRate(data.rateLimit, true);
        return synthetic({ quotes: bundle.quotes, updates: bundle.updates, rateLimit: data?.rateLimit || rateState(), paused: true, message: data?.message || 'Daily free lookup limit reached. Continue tomorrow.' });
      }

      const cache = bundle.cache, now = Date.now();
      for (const card of selected) {
        const quote = data?.quotes?.[card.id], update = data?.updates?.[card.id];
        if (!quote && !update) continue;
        cache[card.id] = { quote: quote || cache[card.id]?.quote || null, update: update || cache[card.id]?.update || null, checkedAt: now };
      }
      writeJson(PRICE_CACHE_KEY, cache);
      enrichStoredCards(data?.updates || {});
      const merged = cachedBundle(allCards);
      return synthetic({ ...data, quotes: { ...merged.quotes, ...(data?.quotes || {}) }, updates: { ...merged.updates, ...(data?.updates || {}) }, cached: false }, response.ok ? 200 : response.status);
    }

    const input = args[0];
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    if (requestUrl.includes('/api/card-search')) {
      try {
        const u = new URL(requestUrl, location.origin);
        const lang = u.searchParams.get('language') || '';
        const q = u.searchParams.get('q') || '';
        if (lang === 'Japanese' && /^([A-Z]{2,5}\d{1,2})-/i.test(q) && jpRemaining() <= 0) {
          return synthetic({ cards: [], paused: true, message: 'Japanese One Piece monthly free lookup guard reached. Continue next month; saved cards and photos are safe.' }, 429);
        }
      } catch {}
    }

    const response = await originalFetch(...args);
    try {
      if (!requestUrl.includes('/api/card-search')) return response;
      const data = await response.clone().json();
      if (data?.rateLimit) saveRate(data.rateLimit, Boolean(data.paused));
      if (Number(data?.jpCallCount || 0) > 0) addJpUsage(Number(data.jpCallCount));
      if (response.status === 429 || data?.paused) return response;
      cacheSearchCards(data?.cards || []);
    } catch {}
    return response;
  };

  window.addEventListener('load', renderBudget);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBudget); else renderBudget();
})();
