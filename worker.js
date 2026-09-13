const TCG_BASE = 'https://api.tcgapi.dev/v1';
const PARSE_BASE = 'https://api.parse.bot/scraper/1d31f593-ebaf-4791-a047-2c9751946cee';
const FALLBACK_USD_PHP = 60;
const FALLBACK_JPY_PHP = 0.40;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function gameSlug(value = '') {
  const v = String(value).toLowerCase();
  if (v.includes('pok')) return 'pokemon';
  if (v.includes('one piece')) return 'one-piece-card-game';
  return '';
}

function displayGame(slug = '') {
  return slug === 'pokemon' ? 'Pokémon' : slug === 'one-piece-card-game' ? 'One Piece' : 'TCG';
}

function norm(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9ぁ-んァ-ン一-龯]/g, '');
}

function isJapaneseOnePiece(card = {}) {
  return String(card.game || '').toLowerCase().includes('one piece') && String(card.language || '').toLowerCase() === 'japanese';
}

function mapTcgCard(row, requestedLanguage = 'English') {
  const slug = row.game_slug || '';
  const language = requestedLanguage === 'Japanese' ? 'Japanese' : 'English';
  return {
    id: `tcg-${row.id}-${String(row.printing || 'normal').toLowerCase().replace(/\s+/g, '-')}`,
    providerId: row.id,
    game: displayGame(slug),
    language,
    name: row.name || 'Unknown card',
    set: row.set_name || '',
    number: row.number || '',
    rarity: row.rarity || '',
    variant: row.printing || (row.foil_only ? 'Foil' : 'Normal'),
    image: row.image_url || '',
    tcgplayerUrl: row.tcgplayer_url || '',
    marketUsd: Number(row.market_price || 0),
    lowUsd: Number(row.low_price || 0),
    medianUsd: Number(row.median_price || 0),
    priceUpdatedAt: row.price_updated_at || null,
    priceSource: 'TCGplayer via TCG API',
    color: slug === 'pokemon' ? '#2f78c4' : '#d74b3f',
    accent: slug === 'pokemon' ? '#f4d548' : '#f2bf45',
    icon: slug === 'pokemon' ? '◆' : '☠'
  };
}

function parseRateLimit(response) {
  const limit = Number(response.headers.get('x-ratelimit-limit') || 100);
  const remaining = Number(response.headers.get('x-ratelimit-remaining'));
  const reset = response.headers.get('x-ratelimit-reset');
  return Number.isFinite(remaining) ? {
    daily_limit: Number.isFinite(limit) ? limit : 100,
    daily_remaining: remaining,
    daily_reset: reset ? new Date(Number(reset) * 1000).toISOString() : null
  } : null;
}

async function tcgSearch(env, query, game = '', perPage = 20) {
  if (!env.TCGAPI_KEY) throw new Error('TCGAPI_KEY is not configured');
  const u = new URL(`${TCG_BASE}/search`);
  u.searchParams.set('q', query);
  u.searchParams.set('type', 'Cards');
  u.searchParams.set('per_page', String(Math.min(Math.max(perPage, 1), 50)));
  u.searchParams.set('sort', 'relevance');
  if (game) u.searchParams.set('game', game);

  const response = await fetch(u, {
    headers: { 'X-API-Key': env.TCGAPI_KEY, 'Accept': 'application/json' }
  });
  const data = await response.json().catch(() => ({}));
  const rateLimit = data.rate_limit || parseRateLimit(response);
  if (!response.ok) {
    const err = new Error(data?.message || `TCG API returned ${response.status}`);
    err.status = response.status;
    err.rateLimit = rateLimit;
    throw err;
  }
  return { ...data, rate_limit: rateLimit || data.rate_limit || null };
}

async function fxRate(from, to, fallback) {
  try {
    const r = await fetch(`https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`, {
      headers: { 'Accept': 'application/json' },
      cf: { cacheTtl: 21600, cacheEverything: true }
    });
    if (!r.ok) throw new Error('FX unavailable');
    const data = await r.json();
    const rate = Number(data?.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : fallback;
  } catch {
    return fallback;
  }
}

async function usdPhpRate() { return fxRate('USD', 'PHP', FALLBACK_USD_PHP); }
async function jpyPhpRate() { return fxRate('JPY', 'PHP', FALLBACK_JPY_PHP); }

function normalizeYuyuRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.cards)) return payload.cards;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.cards)) return payload.data.cards;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  return [];
}

async function yuyuSearch(env, query, filters = {}) {
  if (!env.PARSE_API_KEY) throw new Error('PARSE_API_KEY is not configured');
  const u = new URL(`${PARSE_BASE}/search_cards`);
  u.searchParams.set('search_word', query);
  if (filters.rarity) u.searchParams.set('rarity', filters.rarity);
  if (filters.version) u.searchParams.set('version', filters.version);
  if (filters.card_type) u.searchParams.set('card_type', filters.card_type);

  const response = await fetch(u, {
    headers: { 'X-API-Key': env.PARSE_API_KEY, 'Accept': 'application/json' },
    cf: { cacheTtl: 86400, cacheEverything: true }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.status === 'error') {
    const err = new Error(data?.message || `Yuyu-Tei API returned ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return { raw: data, cards: normalizeYuyuRows(data) };
}

function versionFromCardNumber(number = '') {
  const m = String(number).trim().match(/^([A-Z]{2,5}\d{1,2})-/i);
  return m ? m[1].toLowerCase() : '';
}

function mapYuyuCard(row, jpyPhp) {
  const yen = Number(row.price || 0);
  const idPart = String(row.card_url || row.image_url || `${row.card_code}-${row.card_name}`).replace(/[^a-z0-9]/gi, '').slice(-28);
  return {
    id: `yuyu-${idPart || Math.random().toString(36).slice(2)}`,
    providerId: row.card_url || row.card_code || '',
    game: 'One Piece',
    language: 'Japanese',
    name: row.card_name || 'Unknown card',
    set: String(row.version || '').toUpperCase(),
    number: row.card_code || '',
    rarity: row.rarity || '',
    variant: /パラレル/.test(row.card_name || '') ? 'Parallel' : 'Japanese printing',
    image: row.image_url || '',
    yuyuUrl: row.card_url || '',
    priceYen: yen,
    market: yen > 0 ? Number((yen * jpyPhp).toFixed(2)) : 0,
    priceUpdatedAt: new Date().toISOString(),
    priceSource: 'Yuyu-Tei Japan retail',
    stock: Number(row.stock || 0),
    inStock: Boolean(row.in_stock),
    color: '#d74b3f',
    accent: '#f2bf45',
    icon: '☠'
  };
}

function bestTcgMatch(rows, card) {
  if (!rows?.length) return null;
  const number = norm(card.number), name = norm(card.name), rarity = norm(card.rarity);
  return rows.map(row => {
    let score = 0;
    if (number && norm(row.number) === number) score += 100;
    if (name && norm(row.name) === name) score += 40;
    if (rarity && norm(row.rarity) === rarity) score += 15;
    if (card.variant && norm(row.printing) === norm(card.variant)) score += 10;
    return { row, score };
  }).sort((a, b) => b.score - a.score)[0]?.row || rows[0];
}

function bestYuyuMatch(rows, card) {
  if (!rows?.length) return null;
  const number = norm(card.number), name = norm(card.name), rarity = norm(card.rarity);
  return rows.map(row => {
    let score = 0;
    if (number && norm(row.card_code) === number) score += 100;
    if (card.yuyuUrl && row.card_url === card.yuyuUrl) score += 1000;
    if (card.image && row.image_url === card.image) score += 700;
    if (name && norm(row.card_name).includes(name)) score += 50;
    if (rarity && norm(row.rarity) === rarity) score += 20;
    if (String(card.variant || '').toLowerCase().includes('parallel') && /パラレル/.test(row.card_name || '')) score += 30;
    return { row, score };
  }).sort((a, b) => b.score - a.score)[0]?.row || rows[0];
}

async function handleCardSearch(request, env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const requestedLanguage = url.searchParams.get('language') || 'English';
  const requestedGame = url.searchParams.get('game') || '';
  if (q.length < 2) return json({ cards: [], message: 'Enter at least 2 characters.' }, { status: 400 });

  const jpOnePiece = requestedLanguage === 'Japanese' && (!requestedGame || String(requestedGame).toLowerCase().includes('one piece') || /^([A-Z]{2,5}\d{1,2})-/i.test(q));
  if (jpOnePiece) {
    try {
      const [data, rate] = await Promise.all([
        yuyuSearch(env, q, { version: versionFromCardNumber(q) }),
        jpyPhpRate()
      ]);
      const cards = data.cards.map(row => mapYuyuCard(row, rate));
      return json({ cards, jpCallCount: 1, jpSource: 'Yuyu-Tei', jpyPhpRate: rate, note: 'Japanese One Piece prices are Yuyu-Tei Japan retail prices.' }, { headers: { 'cache-control': 'private, max-age=300' } });
    } catch (error) {
      return json({ cards: [], jpCallCount: 0, message: String(error?.message || error) }, { status: 502 });
    }
  }

  try {
    const data = await tcgSearch(env, q, gameSlug(requestedGame), 24);
    const cards = (data.data || []).map(row => mapTcgCard(row, requestedLanguage));
    return json({ cards, rateLimit: data.rate_limit || null }, { headers: { 'cache-control': 'public, max-age=60' } });
  } catch (error) {
    return json({ cards: [], rateLimit: error?.rateLimit || null, message: String(error?.message || error) }, { status: error?.status === 429 ? 429 : 502 });
  }
}

async function handleCardImage(request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('url');
  if (!raw) return new Response('Missing image URL', { status: 400 });
  let target;
  try { target = new URL(raw); } catch { return new Response('Invalid image URL', { status: 400 }); }
  if (target.protocol !== 'https:') return new Response('HTTPS images only', { status: 400 });

  const allowedHosts = ['tcgplayer-cdn.tcgplayer.com','images.pokemontcg.io','assets.tcgdex.net','en.onepiece-cardgame.com','asia-en.onepiece-cardgame.com'];
  const yuyuHost = target.hostname === 'yuyu-tei.jp' || target.hostname.endsWith('.yuyu-tei.jp');
  if (!yuyuHost && !allowedHosts.some(host => target.hostname === host || target.hostname.endsWith(`.${host}`))) {
    return new Response('Image host not allowed', { status: 403 });
  }

  try {
    const response = await fetch(target.toString(), { headers: { 'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8' }, cf: { cacheTtl: 604800, cacheEverything: true } });
    if (!response.ok) return new Response('Image unavailable', { status: response.status });
    const headers = new Headers();
    headers.set('content-type', response.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=604800');
    return new Response(response.body, { status: 200, headers });
  } catch {
    return new Response('Image unavailable', { status: 502 });
  }
}

async function handlePrices(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
  let payload;
  try { payload = await request.json(); } catch { return json({ quotes: {}, message: 'Invalid JSON' }, { status: 400 }); }
  const cards = Array.isArray(payload?.cards) ? payload.cards.slice(0, 8) : [];
  if (!cards.length) return json({ quotes: {}, updates: {}, jpCallCount: 0 });

  const [usdRate, jpyRate] = await Promise.all([usdPhpRate(), jpyPhpRate()]);
  const quotes = {}, updates = {};
  let latestRateLimit = null;
  let jpCallCount = 0;

  for (const card of cards) {
    const query = String(card.number || card.name || '').trim();
    if (query.length < 2) continue;

    if (isJapaneseOnePiece(card)) {
      try {
        const data = await yuyuSearch(env, query, { version: versionFromCardNumber(card.number), rarity: card.rarity || '' });
        jpCallCount += 1;
        const match = bestYuyuMatch(data.cards, card);
        if (!match) continue;
        const yen = Number(match.price || 0);
        quotes[card.id] = {
          market: yen > 0 ? Number((yen * jpyRate).toFixed(2)) : 0,
          priceYen: yen,
          jpyPhpRate: jpyRate,
          source: 'Yuyu-Tei Japan retail',
          updatedAt: new Date().toISOString()
        };
        updates[card.id] = {
          providerId: match.card_url || match.card_code || '',
          image: match.image_url || card.image || '',
          yuyuUrl: match.card_url || card.yuyuUrl || '',
          priceSource: 'Yuyu-Tei Japan retail',
          lastPriceCheck: new Date().toISOString()
        };
      } catch {}
      continue;
    }

    try {
      const data = await tcgSearch(env, query, gameSlug(card.game), 12);
      latestRateLimit = data.rate_limit || latestRateLimit;
      const match = bestTcgMatch(data.data || [], card);
      if (!match) continue;
      const marketUsd = Number(match.market_price || 0), lowUsd = Number(match.low_price || 0), medianUsd = Number(match.median_price || 0);
      quotes[card.id] = {
        market: marketUsd > 0 ? Number((marketUsd * usdRate).toFixed(2)) : 0,
        low: lowUsd > 0 ? Number((lowUsd * usdRate).toFixed(2)) : 0,
        median: medianUsd > 0 ? Number((medianUsd * usdRate).toFixed(2)) : 0,
        marketUsd,
        usdPhpRate: usdRate,
        source: card.language === 'Japanese' ? 'TCGplayer English market reference' : 'TCGplayer via TCG API',
        updatedAt: match.price_updated_at || new Date().toISOString()
      };
      updates[card.id] = {
        providerId: match.id,
        image: match.image_url || card.image || '',
        tcgplayerUrl: match.tcgplayer_url || card.tcgplayerUrl || '',
        priceSource: quotes[card.id].source,
        lastPriceCheck: new Date().toISOString()
      };
    } catch (error) {
      latestRateLimit = error?.rateLimit || latestRateLimit;
      if (error?.status === 429) return json({ quotes, updates, rateLimit: latestRateLimit, jpCallCount, paused: true, message: 'Daily free TCG lookup limit reached. Continue tomorrow.' }, { status: 429 });
    }
  }

  return json({ quotes, updates, currency: 'PHP', usdPhpRate: usdRate, jpyPhpRate: jpyRate, rateLimit: latestRateLimit, jpCallCount }, { headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/card-search' && request.method === 'GET') return handleCardSearch(request, env);
    if (url.pathname === '/api/card-image' && request.method === 'GET') return handleCardImage(request);
    if (url.pathname === '/api/prices') return handlePrices(request, env);
    return env.ASSETS.fetch(request);
  }
};