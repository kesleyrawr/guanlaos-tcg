import baseWorker from './worker.js';

const PARSE_BASE = 'https://api.parse.bot/scraper/1d31f593-ebaf-4791-a047-2c9751946cee';
const FALLBACK_JPY_PHP = 0.40;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.cards)) return payload.cards;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.cards)) return payload.data.cards;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  return [];
}

function imageUrl(value = '') {
  const s = String(value || '').trim();
  if (!s) return '';
  if (s.startsWith('https://')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `https://yuyu-tei.jp${s}`;
  return s;
}

async function jpyPhpRate() {
  try {
    const r = await fetch('https://api.frankfurter.dev/v2/rate/jpy/php', {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 21600, cacheEverything: true }
    });
    if (!r.ok) throw new Error('FX unavailable');
    const data = await r.json();
    const rate = Number(data?.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_JPY_PHP;
  } catch {
    return FALLBACK_JPY_PHP;
  }
}

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
    throw new Error(data?.message || `Yuyu-Tei API returned ${response.status}`);
  }
  return normalizeRows(data);
}

function isDonQuery(q = '') {
  return /(^|\s)don(?:!!)?($|\s)/i.test(q) || /ドン!!?/i.test(q) || /luffy\s*(?:vs|&|and)\s*kaido/i.test(q);
}

function setHintFromQuery(q = '') {
  const upper = q.toUpperCase();
  if (/LUFFY\s*(?:VS|&|AND)\s*KAIDO/.test(upper) || (/LUFFY/.test(upper) && /KAIDO/.test(upper))) return 'DP-02';
  const m = upper.match(/\b(DP-?\d{2}|OP\d{2}|ST\d{2})\b/);
  return m ? m[1].replace(/^DP(\d{2})$/, 'DP-$1') : '';
}

function rowText(row = {}) {
  return [row.card_code, row.number, row.card_name, row.name, row.version, row.set, row.card_url, row.url]
    .filter(Boolean).join(' ').toUpperCase();
}

function mapCard(row, rate) {
  const yen = Number(row.price || 0);
  const code = row.card_code || row.number || 'DON!!';
  const name = row.card_name || row.name || 'DON!! Card';
  const image = imageUrl(row.image_url || row.image || '');
  const url = row.card_url || row.url || '';
  const idPart = String(url || image || `${code}-${name}`).replace(/[^a-z0-9]/gi, '').slice(-28);
  return {
    id: `yuyu-don-${idPart || Math.random().toString(36).slice(2)}`,
    providerId: url || code,
    game: 'One Piece',
    language: 'Japanese',
    name,
    set: String(row.version || row.set || '').toUpperCase(),
    number: code,
    rarity: row.rarity || 'DON!!',
    variant: 'DON!! Card',
    image,
    yuyuUrl: url,
    priceYen: yen,
    market: yen > 0 ? Number((yen * rate).toFixed(2)) : 0,
    priceUpdatedAt: new Date().toISOString(),
    priceSource: 'Yuyu-Tei Japan retail',
    stock: Number(row.stock || 0),
    inStock: Boolean(row.in_stock),
    color: '#171717',
    accent: '#d9b96c',
    icon: '‼'
  };
}

async function handleDonSearch(request, env) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const requestedGame = (url.searchParams.get('game') || '').toLowerCase();
  if (!isDonQuery(q) || requestedGame.includes('pok')) return null;

  try {
    const [rows, rate] = await Promise.all([yuyuSearch(env, 'ドン!!カード'), jpyPhpRate()]);
    const hint = setHintFromQuery(q);
    let matches = rows;
    if (hint) {
      const normalizedHint = hint.replace('-', '');
      const filtered = rows.filter(row => rowText(row).replace(/-/g, '').includes(normalizedHint));
      if (filtered.length) matches = filtered;
    }
    const cards = matches.map(row => mapCard(row, rate));
    return json({
      cards,
      jpCallCount: 1,
      jpSource: 'Yuyu-Tei',
      jpyPhpRate: rate,
      donSearch: true,
      queryAlias: hint || 'DON!!',
      note: cards.length ? `DON!! results${hint ? ` filtered for ${hint}` : ''}. Confirm the artwork visually before adding.` : 'No DON!! matches found.'
    }, { headers: { 'cache-control': 'private, max-age=300' } });
  } catch (error) {
    return json({ cards: [], jpCallCount: 0, donSearch: true, message: `DON!! lookup unavailable: ${String(error?.message || error)}` }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/card-search' && request.method === 'GET') {
      const don = await handleDonSearch(request, env);
      if (don) return don;
    }
    return baseWorker.fetch(request, env);
  }
};
