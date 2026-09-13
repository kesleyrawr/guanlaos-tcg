import previousWorker from './don-router.js';

const TCGDEX = 'https://api.tcgdex.net/v2';
const FALLBACK_USD_PHP = 60;
const FALLBACK_EUR_PHP = 70;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function norm(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPokemon(card = {}) {
  return String(card.game || '').toLowerCase().includes('pok');
}

function looksPokemonQuery(q = '', game = '') {
  if (String(game).toLowerCase().includes('pok')) return true;
  if (/\b\d{1,3}\s*\/\s*\d{1,3}\b/.test(q)) return true;
  if (/\b(?:M\d[A-Z]|SV\d+[A-Z]?|S\d+[A-Z]?|SM\d+|XY\d+)\b/i.test(q)) return true;
  return false;
}

function parseQuery(q = '', requestedGame = '', requestedLanguage = '') {
  const raw = String(q).trim();
  const fraction = raw.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
  const setCode = raw.match(/\b([A-Z][A-Z0-9-]{1,5})\s+(?=\d{1,3}\s*\/)/i)?.[1] || '';
  const gameText = `${requestedGame} ${requestedLanguage} ${raw}`.toLowerCase();
  let lang = '';
  if (/japanese|\bjp\b|\bjap\b/.test(gameText)) lang = 'ja';
  else if (/english|\ben\b/.test(gameText)) lang = 'en';
  else if (setCode && /^(M\d|SV\d|S\d|SM\d)/i.test(setCode)) lang = 'ja';
  const name = raw
    .replace(/\b[A-Z][A-Z0-9-]{1,5}\s+(?=\d{1,3}\s*\/)/i, '')
    .replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, '')
    .replace(/\b(?:AR|SAR|SR|UR|RR|RRR|CHR|CSR|IR|SIR|HR|PR)\b/gi, '')
    .replace(/\b(?:pokemon|japanese|english|jp|en|jap)\b/gi, '')
    .trim();
  return {
    raw,
    localId: fraction?.[1] || '',
    denominator: fraction?.[2] || '',
    setCode,
    name,
    lang
  };
}

async function fxRate(from, fallback) {
  try {
    const r = await fetch(`https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/php`, {
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

async function tcgdexGet(path) {
  const r = await fetch(`${TCGDEX}${path}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 21600, cacheEverything: true }
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

function imageHigh(image = '') {
  const s = String(image || '');
  if (!s) return '';
  if (/\.(?:webp|png|jpe?g)$/i.test(s)) return s;
  return `${s}/high.webp`;
}

function pickTcgplayer(card) {
  const source = card?.pricing?.tcgplayer;
  if (!source || typeof source !== 'object') return null;
  const preferred = ['holofoil','normal','reverse-holofoil','reverse','unlimited-holofoil','unlimited','1st-edition-holofoil','1st-edition'];
  for (const key of preferred) {
    const row = source[key];
    const market = Number(row?.marketPrice || 0);
    if (market > 0) return { market, low: Number(row?.lowPrice || 0), median: Number(row?.midPrice || 0), variant: key, updated: source.updated || null };
  }
  for (const [key, row] of Object.entries(source)) {
    if (!row || typeof row !== 'object') continue;
    const market = Number(row.marketPrice || 0);
    if (market > 0) return { market, low: Number(row.lowPrice || 0), median: Number(row.midPrice || 0), variant: key, updated: source.updated || null };
  }
  return null;
}

function pickCardmarket(card) {
  const source = card?.pricing?.cardmarket;
  if (!source || typeof source !== 'object') return null;
  const market = Number(source.trend || source.avg7 || source.avg || 0);
  if (!(market > 0)) return null;
  return { market, low: Number(source.low || 0), updated: source.updated || null };
}

function printedNumber(card) {
  const local = String(card.localId || '');
  const official = Number(card?.set?.cardCount?.official || 0);
  return official > 0 ? `${local}/${official}` : local;
}

function mapPokemon(card, lang, rates) {
  const tcg = pickTcgplayer(card);
  const cm = pickCardmarket(card);
  let market = 0, low = 0, median = 0, priceSource = 'TCGdex catalog', priceUpdatedAt = null;
  if (tcg) {
    market = Number((tcg.market * rates.usd).toFixed(2));
    low = tcg.low > 0 ? Number((tcg.low * rates.usd).toFixed(2)) : 0;
    median = tcg.median > 0 ? Number((tcg.median * rates.usd).toFixed(2)) : 0;
    priceSource = lang === 'ja' ? 'TCGplayer via TCGdex · Japanese card · non-Japan marketplace' : 'TCGplayer via TCGdex';
    priceUpdatedAt = tcg.updated;
  } else if (cm) {
    market = Number((cm.market * rates.eur).toFixed(2));
    low = cm.low > 0 ? Number((cm.low * rates.eur).toFixed(2)) : 0;
    priceSource = lang === 'ja' ? 'Cardmarket via TCGdex · Japanese card · non-Japan marketplace' : 'Cardmarket via TCGdex';
    priceUpdatedAt = cm.updated;
  }
  return {
    id: `tcgdex-${lang}-${card.id}`,
    providerId: card.id,
    game: 'Pokémon',
    language: lang === 'ja' ? 'Japanese' : 'English',
    name: card.name || 'Unknown Pokémon card',
    set: card?.set?.name || '',
    setCode: card?.set?.id || '',
    number: printedNumber(card),
    rarity: card.rarity || '',
    variant: tcg?.variant || (card?.variants?.holo ? 'Holo' : card?.variants?.reverse ? 'Reverse' : 'Standard'),
    illustrator: card.illustrator || '',
    image: imageHigh(card.image),
    market,
    low,
    median,
    priceSource,
    priceUpdatedAt: priceUpdatedAt || new Date().toISOString(),
    color: '#2f78c4',
    accent: '#f4d548',
    icon: '◆'
  };
}

async function detailedCandidates(lang, parsed) {
  if (parsed.setCode && parsed.localId) {
    const direct = await tcgdexGet(`/${lang}/sets/${encodeURIComponent(parsed.setCode)}/${encodeURIComponent(parsed.localId)}`);
    if (direct?.id) return [direct];
  }

  let briefs = [];
  if (parsed.localId) {
    const list = await tcgdexGet(`/${lang}/cards?localId=eq:${encodeURIComponent(parsed.localId)}`);
    if (Array.isArray(list)) briefs = list;
  } else if (parsed.name) {
    const list = await tcgdexGet(`/${lang}/cards?name=${encodeURIComponent(parsed.name)}`);
    if (Array.isArray(list)) briefs = list;
  }

  briefs = briefs.slice(0, 24);
  const details = (await Promise.all(briefs.map(x => tcgdexGet(`/${lang}/cards/${encodeURIComponent(x.id)}`)))).filter(Boolean);
  return details.filter(card => {
    if (parsed.localId && String(card.localId) !== String(parsed.localId)) return false;
    if (parsed.denominator) {
      const official = Number(card?.set?.cardCount?.official || 0);
      if (official && official !== Number(parsed.denominator)) return false;
    }
    if (parsed.setCode) {
      const hay = `${card?.set?.id || ''} ${card?.set?.name || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!hay.includes(norm(parsed.setCode))) return false;
    }
    return true;
  });
}

async function searchPokemon(q, game, language) {
  const parsed = parseQuery(q, game, language);
  const languages = parsed.lang ? [parsed.lang] : ['en', 'ja'];
  const [usd, eur] = await Promise.all([fxRate('USD', FALLBACK_USD_PHP), fxRate('EUR', FALLBACK_EUR_PHP)]);
  const groups = await Promise.all(languages.map(async lang => {
    const rows = await detailedCandidates(lang, parsed);
    return rows.map(card => mapPokemon(card, lang, { usd, eur }));
  }));
  const cards = groups.flat();
  cards.sort((a, b) => {
    const aSet = parsed.setCode && norm(a.setCode) === norm(parsed.setCode) ? 1 : 0;
    const bSet = parsed.setCode && norm(b.setCode) === norm(parsed.setCode) ? 1 : 0;
    return bSet - aSet || a.language.localeCompare(b.language) || a.name.localeCompare(b.name);
  });
  return { cards: cards.slice(0, 30), parsed };
}

async function handlePokemonSearch(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const game = url.searchParams.get('game') || '';
  const language = url.searchParams.get('language') || '';
  if (!looksPokemonQuery(q, game)) return null;
  try {
    const result = await searchPokemon(q, game, language);
    return json({
      cards: result.cards,
      pokemonSource: 'TCGdex',
      note: result.cards.length ? 'Pokémon results from TCGdex. Confirm artwork and language before adding.' : 'No matching Pokémon cards found in TCGdex.'
    }, { headers: { 'cache-control': 'private, max-age=300' } });
  } catch (error) {
    return json({ cards: [], pokemonSource: 'TCGdex', message: `Pokémon lookup unavailable: ${String(error?.message || error)}` }, { status: 502 });
  }
}

async function pokemonPriceBundle(cards) {
  const [usd, eur] = await Promise.all([fxRate('USD', FALLBACK_USD_PHP), fxRate('EUR', FALLBACK_EUR_PHP)]);
  const quotes = {}, updates = {};
  for (const card of cards) {
    const lang = String(card.language || '').toLowerCase() === 'japanese' ? 'ja' : 'en';
    let detail = null;
    if (card.providerId) detail = await tcgdexGet(`/${lang}/cards/${encodeURIComponent(card.providerId)}`);
    if (!detail) {
      const parsed = parseQuery(`${card.setCode || ''} ${card.number || ''} ${card.name || ''}`, card.game, card.language);
      const rows = await detailedCandidates(lang, parsed);
      detail = rows[0] || null;
    }
    if (!detail) continue;
    const mapped = mapPokemon(detail, lang, { usd, eur });
    if (mapped.market > 0) {
      quotes[card.id] = {
        market: mapped.market,
        low: mapped.low,
        median: mapped.median,
        source: mapped.priceSource,
        updatedAt: mapped.priceUpdatedAt
      };
    }
    updates[card.id] = {
      providerId: mapped.providerId,
      image: mapped.image || card.image || '',
      priceSource: mapped.priceSource,
      setCode: mapped.setCode || card.setCode || '',
      lastPriceCheck: new Date().toISOString()
    };
  }
  return { quotes, updates };
}

async function handleMixedPrices(request, env) {
  let payload;
  try { payload = await request.clone().json(); } catch { return null; }
  const cards = Array.isArray(payload?.cards) ? payload.cards : [];
  const pokemon = cards.filter(isPokemon);
  if (!pokemon.length) return null;
  const other = cards.filter(c => !isPokemon(c));
  const pokemonResult = await pokemonPriceBundle(pokemon);
  let otherData = { quotes: {}, updates: {}, jpCallCount: 0 };
  if (other.length) {
    const next = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ ...payload, cards: other })
    });
    const response = await previousWorker.fetch(next, env);
    try { otherData = await response.json(); } catch {}
  }
  return json({
    ...otherData,
    quotes: { ...(otherData.quotes || {}), ...pokemonResult.quotes },
    updates: { ...(otherData.updates || {}), ...pokemonResult.updates },
    pokemonSource: 'TCGdex'
  }, { headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/card-search' && request.method === 'GET') {
      const pokemon = await handlePokemonSearch(request);
      if (pokemon) return pokemon;
    }
    if (url.pathname === '/api/prices' && request.method === 'POST') {
      const prices = await handleMixedPrices(request, env);
      if (prices) return prices;
    }
    return previousWorker.fetch(request, env);
  }
};
