const TCG_BASE = 'https://api.tcgapi.dev/v1';
const FALLBACK_USD_PHP = 60;

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
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapCard(row, requestedLanguage = 'English') {
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

async function tcgSearch(env, query, game = '', perPage = 20) {
  if (!env.TCGAPI_KEY) throw new Error('TCGAPI_KEY is not configured');
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
  if (!response.ok) {
    throw new Error(data?.message || `TCG API returned ${response.status}`);
  }
  return data;
}

async function usdPhpRate() {
  try {
    const r = await fetch('https://api.frankfurter.dev/v2/rate/usd/php', {
      headers: { 'Accept': 'application/json' },
      cf: { cacheTtl: 21600, cacheEverything: true }
    });
    if (!r.ok) throw new Error('FX unavailable');
    const data = await r.json();
    const rate = Number(data?.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_USD_PHP;
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
    const data = await tcgSearch(env, q, gameSlug(requestedGame), 24);
    const cards = (data.data || []).map(row => mapCard(row, requestedLanguage));
    return json({
      cards,
      rateLimit: data.rate_limit || null,
      note: requestedLanguage === 'Japanese'
        ? 'Artwork and pricing are matched from the English/TCGplayer catalog when available.'
        : null
    }, { headers: { 'cache-control': 'public, max-age=60' } });
  } catch (error) {
    return json({ cards: [], message: String(error?.message || error) }, { status: 502 });
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
      cf: { cacheTtl: 86400, cacheEverything: true }
    });
    if (!response.ok) return new Response('Image unavailable', { status: response.status });
    const headers = new Headers();
    headers.set('content-type', response.headers.get('content-type') || 'image/jpeg');
    headers.set('cache-control', 'public, max-age=86400');
    return new Response(response.body, { status: 200, headers });
  } catch {
    return new Response('Image unavailable', { status: 502 });
  }
}

async function handlePrices(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  let payload;
  try { payload = await request.json(); } catch { return json({ quotes: {}, message: 'Invalid JSON' }, { status: 400 }); }
  const cards = Array.isArray(payload?.cards) ? payload.cards.slice(0, 20) : [];
  if (!cards.length) return json({ quotes: {}, updates: {} });

  const rate = await usdPhpRate();
  const quotes = {};
  const updates = {};

  for (const card of cards) {
    const query = String(card.number || card.name || '').trim();
    if (query.length < 2) continue;

    try {
      const data = await tcgSearch(env, query, gameSlug(card.game), 12);
      const match = bestMatch(data.data || [], card);
      if (!match) continue;

      const marketUsd = Number(match.market_price || 0);
      const lowUsd = Number(match.low_price || 0);
      const medianUsd = Number(match.median_price || 0);

      quotes[card.id] = {
        market: marketUsd > 0 ? Number((marketUsd * rate).toFixed(2)) : 0,
        low: lowUsd > 0 ? Number((lowUsd * rate).toFixed(2)) : 0,
        median: medianUsd > 0 ? Number((medianUsd * rate).toFixed(2)) : 0,
        marketUsd,
        usdPhpRate: rate,
        source: card.language === 'Japanese' ? 'TCGplayer English market reference' : 'TCGplayer via TCG API',
        updatedAt: match.price_updated_at || new Date().toISOString()
      };

      updates[card.id] = {
        providerId: match.id,
        image: match.image_url || card.image || '',
        tcgplayerUrl: match.tcgplayer_url || card.tcgplayerUrl || '',
        priceSource: quotes[card.id].source
      };
    } catch {
      // Keep the rest of the collection updating even if one card fails.
    }
  }

  return json({ quotes, updates, currency: 'PHP', usdPhpRate: rate }, {
    headers: { 'cache-control': 'no-store' }
  });
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
