const TCG_BASE = 'https://api.tcgapi.dev/v1';
const FALLBACK_USD_PHP = 60;
const PRICE_CACHE_SECONDS = 24 * 60 * 60;
const SEARCH_CACHE_SECONDS = 24 * 60 * 60;
const PRICE_RESERVE = 10;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function gameSlug(value = '', language = '') {
  const v = String(value).toLowerCase();
  const lang = String(language).toLowerCase();
  if (v.includes('pok')) return lang.includes('jap') ? 'pokemon-japan' : 'pokemon';
  if (v.includes('one piece')) return 'one-piece-card-game';
  return '';
}

function displayGame(slug = '') {
  if (slug === 'pokemon' || slug === 'pokemon-japan') return 'Pokémon';
  if (slug === 'one-piece-card-game') return 'One Piece';
  return 'TCG';
}

function norm(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rateInfo(data, response) {
  const body = data?.rate_limit || null;
  const limit = Number(response?.headers?.get('X-RateLimit-Limit') || body?.daily_limit || 0) || null;
  const remaining = Number(response?.headers?.get('X-RateLimit-Remaining') || body?.daily_remaining || 0);
  const reset = response?.headers?.get('X-RateLimit-Reset') || body?.daily_reset || null;
  return {
    daily_limit: limit,
    daily_remaining: Number.isFinite(remaining) ? remaining : null,
    daily_reset: reset || null
  };
}

function mapCard(row, requestedLanguage = 'English', usdPhp = FALLBACK_USD_PHP) {
  const slug = row.game_slug || '';
  const isJapanPokemon = slug === 'pokemon-japan';
  const language = isJapanPokemon || requestedLanguage === 'Japanese' ? 'Japanese' : 'English';
  const marketUsd = Number(row.market_price || 0);
  const lowUsd = Number(row.low_price || 0);
  const medianUsd = Number(row.median_price || 0);
  const source = isJapanPokemon
    ? 'Pokémon Japan market via TCG API'
    : language === 'Japanese' && slug === 'one-piece-card-game'
      ? 'TCGplayer English market reference'
      : 'TCGplayer via TCG API';

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
    marketUsd,
    lowUsd,
    medianUsd,
    market: marketUsd > 0 ? Number((marketUsd * usdPhp).toFixed(2)) : 0,
    low: lowUsd > 0 ? Number((lowUsd * usdPhp).toFixed(2)) : 0,
    median: medianUsd > 0 ? Number((medianUsd * usdPhp).toFixed(2)) : 0,
    usdPhpRate: usdPhp,
    priceUpdatedAt: row.price_updated_at || null,
    priceSource: source,
    color: slug.startsWith('pokemon') ? '#2f78c4' : '#d74b3f',
    accent: slug.startsWith('pokemon') ? '#f4d548' : '#f2bf45',
    icon: slug.startsWith('pokemon') ? '◆' : '☠'
  };
}

async function cacheGet(key) {
  try {
    const cache = caches.default;
    const hit = await cache.match(key);
    if (!hit) return null;
    return await hit.json();
  } catch {
    return null;
  }
}

async function cachePut(key, data, ttl) {
  try {
    const cache = caches.default;
    await cache.put(key, new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=${ttl}`
      }
    }));
  } catch {
    // Cache failure should never block the app.
  }
}

function searchCacheKey(query, game, perPage) {
  const u = new URL('https://guanlao-cache.invalid/search');
  u.searchParams.set('q', String(query).trim().toLowerCase());
  if (game) u.searchParams.set('game', game);
  u.searchParams.set('per_page', String(perPage));
  return new Request(u.toString(), { method: 'GET' });
}

async function tcgSearch(env, query, game = '', perPage = 20, cacheSeconds = SEARCH_CACHE_SECONDS) {
  if (!env.TCGAPI_KEY) throw new Error('TCGAPI_KEY is not configured');

  const cacheKey = searchCacheKey(query, game, perPage);
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, _fromCache: true };

  const u = new URL(`${TCG_BASE}/search`);
  u.searchParams.set('q', query);
  u.searchParams.set('type', 'Cards');
  u.searchParams.set('per_page', String(Math.min(Math.max(perPage, 1), 50)));
  u.searchParams.set('sort', 'relevance');
  if (game) u.searchParams.set('game', game);

  const response = await fetch(u, {
    headers: {
      'X-API-Key': env.TCGAPI_KEY,
      'Accept': 'application/json'
    }
  });
  const data = await response.json().catch(() => ({}));
  const rateLimit = rateInfo(data, response);

  if (response.status === 429) {
    const err = new Error('Daily free lookup limit reached. Continue tomorrow.');
    err.status = 429;
    err.rateLimit = rateLimit;
    throw err;
  }
  if (!response.ok) {
    const err = new Error(data?.message || `TCG API returned ${response.status}`);
    err.status = response.status;
    err.rateLimit = rateLimit;
    throw err;
  }

  const out = { ...data, rate_limit: rateLimit };
  await cachePut(cacheKey, out, cacheSeconds);
  return out;
}

async function usdPhpRate() {
  const key = new Request('https://guanlao-cache.invalid/fx/usd-php');
  const cached = await cacheGet(key);
  if (cached?.rate) return Number(cached.rate);

  try {
    const r = await fetch('https://api.frankfurter.dev/v2/rate/usd/php', {
      headers: { 'Accept': 'application/json' }
    });
    if (!r.ok) throw new Error('FX unavailable');
    const data = await r.json();
    const rate = Number(data?.rate);
    const good = Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_USD_PHP;
    await cachePut(key, { rate: good }, 21600);
    return good;
  } catch {
    return FALLBACK_USD_PHP;
  }
}

function bestMatch(rows, card) {
  if (!rows?.length) return null;
  const number = norm(card.number);
  const name = norm(card.name);
  const rarity = norm(card.rarity);

  const scored = rows.map(row => {
    let score = 0;
    if (number && norm(row.number) === number) score += 100;
    if (name && norm(row.name) === name) score += 40;
    if (rarity && norm(row.rarity) === rarity) score += 15;
    if (card.variant && norm(row.printing) === norm(card.variant)) score += 10;
    return { row, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.row || rows[0];
}

async function handleCardSearch(request, env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const requestedLanguage = url.searchParams.get('language') || 'English';
  const requestedGame = url.searchParams.get('game') || '';

  if (q.length < 2) return json({ cards: [], message: 'Enter at least 2 characters.' }, { status: 400 });

  try {
    const rate = await usdPhpRate();
    const slug = gameSlug(requestedGame, requestedLanguage);
    const data = await tcgSearch(env, q, slug, 24);
    const cards = (data.data || []).map(row => mapCard(row, requestedLanguage, rate));
    return json({
      cards,
      rateLimit: data._fromCache ? null : (data.rate_limit || null),
      cached: Boolean(data._fromCache),
      note: requestedLanguage === 'Japanese' && slug === 'one-piece-card-game'
        ? 'One Piece Japanese cards use English/TCGplayer pricing as a reference until a dedicated Japanese-market source is connected.'
        : null
    }, { headers: { 'cache-control': 'public, max-age=60' } });
  } catch (error) {
    const status = error?.status === 429 ? 429 : 502;
    return json({
      cards: [],
      message: String(error?.message || error),
      rateLimit: error?.rateLimit || null,
      paused: status === 429
    }, { status });
  }
}

async function handleCardImage(request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('url');
  if (!raw) return new Response('Missing image URL', { status: 400 });

  let target;
  try { target = new URL(raw); } catch { return new Response('Invalid image URL', { status: 400 }); }
  if (target.protocol !== 'https:') return new Response('HTTPS images only', { status: 400 });

  const allowed = [
    'tcgplayer-cdn.tcgplayer.com',
    'images.pokemontcg.io',
    'assets.tcgdex.net',
    'en.onepiece-cardgame.com',
    'asia-en.onepiece-cardgame.com'
  ];
  if (!allowed.some(host => target.hostname === host || target.hostname.endsWith(`.${host}`))) {
    return new Response('Image host not allowed', { status: 403 });
  }

  try {
    const response = await fetch(target.toString(), {
      headers: { 'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8' },
      cf: { cacheTtl: 604800, cacheEverything: true }
    });
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
  const cards = Array.isArray(payload?.cards) ? payload.cards.slice(0, 12) : [];
  if (!cards.length) return json({ quotes: {}, updates: {}, rateLimit: null });

  const rate = await usdPhpRate();
  const quotes = {};
  const updates = {};
  let latestRateLimit = null;
  let paused = false;
  let processed = 0;

  for (const card of cards) {
    const query = String(card.number || card.name || '').trim();
    if (query.length < 2) continue;

    try {
      const data = await tcgSearch(env, query, gameSlug(card.game, card.language), 12, PRICE_CACHE_SECONDS);
      if (!data._fromCache && data.rate_limit) latestRateLimit = data.rate_limit;

      const match = bestMatch(data.data || [], card);
      if (!match) continue;

      const mapped = mapCard(match, card.language || 'English', rate);
      quotes[card.id] = {
        market: mapped.market,
        low: mapped.low,
        median: mapped.median,
        marketUsd: mapped.marketUsd,
        usdPhpRate: rate,
        source: mapped.priceSource,
        updatedAt: mapped.priceUpdatedAt || new Date().toISOString(),
        checkedAt: new Date().toISOString()
      };

      updates[card.id] = {
        providerId: match.id,
        image: match.image_url || card.image || '',
        tcgplayerUrl: match.tcgplayer_url || card.tcgplayerUrl || '',
        priceSource: mapped.priceSource,
        lastPriceCheck: new Date().toISOString()
      };
      processed += 1;

      const remaining = Number(latestRateLimit?.daily_remaining);
      if (Number.isFinite(remaining) && remaining <= PRICE_RESERVE) {
        paused = true;
        break;
      }
    } catch (error) {
      if (error?.status === 429) {
        latestRateLimit = error?.rateLimit || latestRateLimit;
        paused = true;
        break;
      }
      // Keep updating the rest if one lookup fails for a normal reason.
    }
  }

  const message = paused
    ? 'Automatic price refresh paused to protect the free daily lookup allowance. Continue tomorrow after the API resets.'
    : null;

  return json({
    quotes,
    updates,
    currency: 'PHP',
    usdPhpRate: rate,
    rateLimit: latestRateLimit,
    paused,
    processed,
    reserve: PRICE_RESERVE,
    message
  }, { headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/card-search' && request.method === 'GET') {
      return handleCardSearch(request, env);
    }
    if (url.pathname === '/api/card-image' && request.method === 'GET') {
      return handleCardImage(request);
    }
    if (url.pathname === '/api/prices') {
      return handlePrices(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
