import previousWorker from './pokemon-router.js';

const COOLDOWN_MS = 90 * 1000;
let cooldownUntil = 0;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function retrySeconds() {
  return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
}

function isJapaneseOnePieceCard(card = {}) {
  return String(card.game || '').toLowerCase().includes('one piece') && String(card.language || '').toLowerCase() === 'japanese';
}

function isJpOnePieceSearch(url) {
  const q = String(url.searchParams.get('q') || '').trim();
  const game = String(url.searchParams.get('game') || '').toLowerCase();
  const language = String(url.searchParams.get('language') || '').toLowerCase();
  if (game.includes('pok')) return false;
  if (language === 'japanese' && (game.includes('one piece') || /^OP\d{2}-\d{3}$/i.test(q))) return true;
  if (/^OP\d{2}-\d{3}$/i.test(q)) return true;
  if (/(^|\s)don(?:!!)?($|\s)/i.test(q) || /ドン!!?/i.test(q) || /luffy\s*(?:vs|&|and)\s*kaido/i.test(q)) return true;
  return false;
}

function friendlyPayload(extra = {}) {
  return {
    cards: [],
    rateLimited: true,
    retryAfter: retrySeconds() || 90,
    cooldownUntil,
    message: 'Japanese lookup is temporarily busy. Please try again in about a minute.',
    ...extra
  };
}

async function responseJson(response) {
  try { return await response.clone().json(); }
  catch { return null; }
}

function looksRateLimited(response, data) {
  if (response.status === 429) return true;
  const text = `${data?.message || ''} ${data?.note || ''}`.toLowerCase();
  return text.includes('429') || text.includes('too many requests') || text.includes('rate limit');
}

async function handlePriceCooldown(request, env) {
  if (Date.now() >= cooldownUntil) return null;
  let payload;
  try { payload = await request.clone().json(); } catch { return null; }
  const cards = Array.isArray(payload?.cards) ? payload.cards : [];
  if (!cards.some(isJapaneseOnePieceCard)) return null;

  const allowed = cards.filter(card => !isJapaneseOnePieceCard(card));
  if (!allowed.length) {
    return json({ quotes: {}, updates: {}, jpCallCount: 0, ...friendlyPayload() }, { status: 200, headers: { 'cache-control': 'no-store' } });
  }

  const nextRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ ...payload, cards: allowed })
  });
  const response = await previousWorker.fetch(nextRequest, env);
  const data = await responseJson(response) || {};
  return json({ ...data, jpCallCount: 0, rateLimited: true, retryAfter: retrySeconds(), cooldownUntil, jpMessage: friendlyPayload().message }, { status: response.ok ? 200 : response.status, headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/card-search' && request.method === 'GET' && isJpOnePieceSearch(url) && Date.now() < cooldownUntil) {
      return json(friendlyPayload(), { status: 429, headers: { 'Retry-After': String(retrySeconds() || 90), 'cache-control': 'no-store' } });
    }

    if (url.pathname === '/api/prices' && request.method === 'POST') {
      const guarded = await handlePriceCooldown(request, env);
      if (guarded) return guarded;
    }

    const response = await previousWorker.fetch(request, env);
    if (!url.pathname.startsWith('/api/')) return response;

    const data = await responseJson(response);
    if (!looksRateLimited(response, data)) return response;

    cooldownUntil = Date.now() + COOLDOWN_MS;
    if (url.pathname === '/api/card-search') {
      return json(friendlyPayload({ originalStatus: response.status }), { status: 429, headers: { 'Retry-After': '90', 'cache-control': 'no-store' } });
    }

    return json({ ...(data || {}), rateLimited: true, retryAfter: 90, cooldownUntil, jpMessage: friendlyPayload().message }, { status: response.ok ? 200 : response.status, headers: { 'cache-control': 'no-store' } });
  }
};
