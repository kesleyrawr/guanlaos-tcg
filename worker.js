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

function norm(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9ぁ-んァ-ン一-龯]/g, '');
}

function gameSlug(value = '') {
  const v = String(value).toLowerCase();
  if (v.includes('pok')) return 'pokemon';
  if (v.includes('one piece')) return 'one-piece-card-game';
  return '';
}

function isOnePieceCode(value = '') {
  return /^OP\d{2}-\d{3}$/i.test(String(value).trim());
}

function isJapaneseOnePiece(card = {}) {
  return String(card.game || '').toLowerCase().includes('one piece') && String(card.language || '').toLowerCase() === 'japanese';
}

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

function normalizeYuyuImage(value = '') {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.startsWith('https://')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `https://yuyu-tei.jp${s}`;
  return s;
}

async function fxRate(from, to, fallback) {
  try {
    const r = await fetch(`https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`, {
      headers: { Accept: 'application/json' },
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

async function yuyuSearch(env, query) {
  if (!env.PARSE_API_KEY) throw new Error('PARSE_API_KEY is not configured');
  const u = new URL(`${PARSE_BASE}/search_cards`);
  u.searchParams.set('search_word', query);
  const response = await fetch(u, {
    headers: { 'X-API-Key': env.PARSE_API_KEY, Accept: 'application/json' },
    cf: { cacheTtl: 86400, cacheEverything: true }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.status === 'error') {
    const error = new Error(data?.message || `Yuyu-Tei API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { raw: data, cards: normalizeYuyuRows(data) };
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
    headers: { 'X-API-Key': env.TCGAPI_KEY, Accept: 'application/json' }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || `TCG API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function mapYuyuCard(row, jpyPhp) {
  const yen = Number(row.price || 0);
  const code = row.card_code || row.number || '';
  const name = row.card_name || row.name || 'Unknown card';
  const image = normalizeYuyuImage(row.image_url || row.image || '');
  const url = row.card_url || row.url || '';
  const idPart = String(url || image || `${code}-${name}`).replace(/[^a-z0-9]/gi, '').slice(-28);
  return {
    id: `yuyu-${idPart || norm(code + name)}`,
    providerId: url || code,
    game: 'One Piece',
    language: 'Japanese',
    name,
    set: String(row.version || row.set || '').toUpperCase(),
    number: code,
    rarity: row.rarity || '',
    variant: /パラレル/.test(name) ? 'Parallel' : 'Japanese printing',
    image,
    yuyuUrl: url,
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

function mapTcgCard(row, requestedLanguage = 'English') {
  const slug = row.game_slug || '';
  return {
    id: `tcg-${row.id}-${String(row.printing || 'normal').toLowerCase().replace(/\s+/g, '-')}`,
    providerId: row.id,
    game: slug === 'pokemon' ? 'Pokémon' : slug === 'one-piece-card-game' ? 'One Piece' : 'TCG',
    language: requestedLanguage === 'Japanese' ? 'Japanese' : 'English',
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

function bestYuyuMatch(rows, card) {
  if (!rows?.length) return null;
  const number = norm(card.number), name = norm(card.name), rarity = norm(card.rarity);
  return rows.map(row => {
    const rowCode = row.card_code || row.number || '';
    const rowName = row.card_name || row.name || '';
    const rowImage = normalizeYuyuImage(row.image_url || row.image || '');
    const rowUrl = row.card_url || row.url || '';
    let score = 0;
    if (number && norm(rowCode) === number) score += 100;
    if (card.yuyuUrl && rowUrl === card.yuyuUrl) score += 1000;
    if (card.image && rowImage === card.image) score += 700;
    if (name && norm(rowName).includes(name)) score += 50;
    if (rarity && norm(row.rarity) === rarity) score += 20;
    if (String(card.variant || '').toLowerCase().includes('parallel') && /パラレル/.test(rowName)) score += 30;
    return { row, score };
  }).sort((a, b) => b.score - a.score)[0]?.row || rows[0];
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

async function handleCardSearch(request, env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const requestedLanguage = url.searchParams.get('language') || '';
  const requestedGame = url.searchParams.get('game') || '';
  if (q.length < 2) return json({ cards: [], message: 'Enter at least 2 characters.' }, { status: 400 });

  const jpOnePiece = requestedLanguage === 'Japanese' || (isOnePieceCode(q) && !String(requestedGame).toLowerCase().includes('pok'));
  if (jpOnePiece && isOnePieceCode(q)) {
    try {
      const [yuyu, rate] = await Promise.all([yuyuSearch(env, q), jpyPhpRate()]);
      const cards = yuyu.cards.map(row => mapYuyuCard(row, rate));
      return json({
        cards,
        jpCallCount: 1,
        jpSource: 'Yuyu-Tei',
        jpyPhpRate: rate,
        note: cards.length ? 'Japanese One Piece results from Yuyu-Tei.' : 'No Japanese One Piece match found.'
      }, { headers: { 'cache-control': 'private, max-age=300' } });
    } catch (error) {
      return json({ cards: [], jpCallCount: 0, message: `Japanese One Piece lookup unavailable: ${String(error?.message || error)}` }, { status: 502 });
    }
  }

  try {
    const data = await tcgSearch(env, q, gameSlug(requestedGame), 24);
    return json({ cards: (data.data || []).map(row => mapTcgCard(row, requestedLanguage || 'English')) }, { headers: { 'cache-control': 'public, max-age=60' } });
  } catch (error) {
    const message = error?.status === 402
      ? 'TCG provider is temporarily unavailable on this account. Japanese One Piece search still works through Yuyu-Tei.'
      : String(error?.message || error);
    return json({ cards: [], message, providerError: error?.status || null }, { status: 200, headers: { 'cache-control': 'no-store' } });
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
    const response = await fetch(target.toString(), {
      headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
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
  const cards = Array.isArray(payload?.cards) ? payload.cards.slice(0, 8) : [];
  if (!cards.length) return json({ quotes: {}, updates: {}, jpCallCount: 0 });

  const [usdRate, jpyRate] = await Promise.all([usdPhpRate(), jpyPhpRate()]);
  const quotes = {}, updates = {};
  let jpCallCount = 0;
  let tcgProviderError = null;

  for (const card of cards) {
    const query = String(card.number || card.name || '').trim();
    if (query.length < 2) continue;

    if (isJapaneseOnePiece(card)) {
      try {
        const yuyu = await yuyuSearch(env, query);
        jpCallCount += 1;
        const match = bestYuyuMatch(yuyu.cards, card);
        if (!match) continue;
        const mapped = mapYuyuCard(match, jpyRate);
        quotes[card.id] = {
          market: mapped.market,
          priceYen: mapped.priceYen,
          jpyPhpRate: jpyRate,
          source: mapped.priceSource,
          updatedAt: mapped.priceUpdatedAt
        };
        updates[card.id] = {
          providerId: mapped.providerId,
          image: mapped.image || card.image || '',
          yuyuUrl: mapped.yuyuUrl || card.yuyuUrl || '',
          priceSource: mapped.priceSource,
          lastPriceCheck: new Date().toISOString()
        };
      } catch {
        // Japanese One Piece stays independent from TCG API.
      }
      continue;
    }

    try {
      const data = await tcgSearch(env, query, gameSlug(card.game), 12);
      const match = bestTcgMatch(data.data || [], card);
      if (!match) continue;
      const marketUsd = Number(match.market_price || 0), lowUsd = Number(match.low_price || 0), medianUsd = Number(match.median_price || 0);
      quotes[card.id] = {
        market: marketUsd > 0 ? Number((marketUsd * usdRate).toFixed(2)) : 0,
        low: lowUsd > 0 ? Number((lowUsd * usdRate).toFixed(2)) : 0,
        median: medianUsd > 0 ? Number((medianUsd * usdRate).toFixed(2)) : 0,
        marketUsd,
        usdPhpRate: usdRate,
        source: 'TCGplayer via TCG API',
        updatedAt: match.price_updated_at || new Date().toISOString()
      };
      updates[card.id] = {
        providerId: match.id,
        image: match.image_url || card.image || '',
        tcgplayerUrl: match.tcgplayer_url || card.tcgplayerUrl || '',
        priceSource: 'TCGplayer via TCG API',
        lastPriceCheck: new Date().toISOString()
      };
    } catch (error) {
      tcgProviderError = error?.status || 'unavailable';
    }
  }

  return json({
    quotes,
    updates,
    currency: 'PHP',
    usdPhpRate: usdRate,
    jpyPhpRate: jpyRate,
    jpCallCount,
    tcgProviderError
  }, { headers: { 'cache-control': 'no-store' } });
}

async function handleHealth(request, env) {
  const url = new URL(request.url);
  const base = {
    ok: true,
    tcgKeyConfigured: Boolean(env.TCGAPI_KEY),
    parseKeyConfigured: Boolean(env.PARSE_API_KEY),
    worker: 'guanlaos-tcg'
  };
  if (url.searchParams.get('probe') !== '1') return json(base, { headers: { 'cache-control': 'no-store' } });

  const result = { ...base, parseProbe: null, tcgProbe: null };
  try {
    const y = await yuyuSearch(env, 'OP17-112');
    result.parseProbe = { ok: true, matches: y.cards.length };
  } catch (error) {
    result.parseProbe = { ok: false, error: String(error?.message || error) };
  }
  try {
    const t = await tcgSearch(env, 'OP17-112', 'one-piece-card-game', 5);
    result.tcgProbe = { ok: true, matches: (t.data || []).length };
  } catch (error) {
    result.tcgProbe = { ok: false, error: String(error?.message || error) };
  }
  result.ok = Boolean(result.parseProbe?.ok || result.tcgProbe?.ok);
  return json(result, { headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') return handleHealth(request, env);
    if (url.pathname === '/api/card-search' && request.method === 'GET') return handleCardSearch(request, env);
    if (url.pathname === '/api/card-image' && request.method === 'GET') return handleCardImage(request);
    if (url.pathname === '/api/prices') return handlePrices(request, env);
    return env.ASSETS.fetch(request);
  }
};