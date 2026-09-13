(() => {
  const KEY = 'guanlao-jp-cooldown-v1';
  const DEFAULT_MS = 90 * 1000;
  const baseFetch = window.fetch.bind(window);

  function readUntil() {
    const value = Number(localStorage.getItem(KEY) || 0);
    if (!Number.isFinite(value) || value <= Date.now()) {
      localStorage.removeItem(KEY);
      return 0;
    }
    return value;
  }

  function writeUntil(value) {
    const until = Number(value || 0) || (Date.now() + DEFAULT_MS);
    localStorage.setItem(KEY, String(until));
    renderBadge();
  }

  function friendly(until = readUntil()) {
    const left = Math.max(1, Math.ceil((until - Date.now()) / 1000));
    return {
      cards: [],
      rateLimited: true,
      retryAfter: left,
      cooldownUntil: until,
      message: `Japanese lookup is temporarily busy. Please try again in ${left} second${left === 1 ? '' : 's'}.`
    };
  }

  function isJpSearch(url) {
    try {
      const u = new URL(url, location.origin);
      if (!u.pathname.includes('/api/card-search')) return false;
      const q = String(u.searchParams.get('q') || '').trim();
      const game = String(u.searchParams.get('game') || '').toLowerCase();
      const language = String(u.searchParams.get('language') || '').toLowerCase();
      if (game.includes('pok')) return false;
      if (/^OP\d{2}-\d{3}$/i.test(q)) return true;
      if (language === 'japanese' && game.includes('one piece')) return true;
      if (/(^|\s)don(?:!!)?($|\s)/i.test(q) || /ドン!!?/i.test(q)) return true;
      return false;
    } catch { return false; }
  }

  function synthetic(data, status = 429) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  async function inspectResponse(response) {
    try {
      const data = await response.clone().json();
      const text = `${data?.message || ''} ${data?.jpMessage || ''} ${data?.note || ''}`.toLowerCase();
      const limited = response.status === 429 || data?.rateLimited || text.includes('yuyu-tei api returned 429') || text.includes('too many requests') || text.includes('rate limit');
      if (!limited) return response;
      const until = Number(data?.cooldownUntil || 0) || (Date.now() + Number(data?.retryAfter || 90) * 1000);
      writeUntil(until);
      if (response.status === 429 || text.includes('429')) return synthetic(friendly(until), 429);
    } catch {}
    return response;
  }

  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || '';
    const until = readUntil();
    if (until && isJpSearch(url)) return synthetic(friendly(until), 429);
    const response = await baseFetch(...args);
    return inspectResponse(response);
  };

  function renderBadge() {
    const until = readUntil();
    let badge = document.getElementById('jpCooldownBadge');
    if (!until) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'jpCooldownBadge';
      badge.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9990;padding:10px 13px;border:2px solid #172b63;border-radius:10px;background:#fff4bb;box-shadow:4px 4px 0 #e95736;color:#172b63;font:800 12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;';
      document.body.appendChild(badge);
    }
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    badge.textContent = `🇯🇵 JP lookup cooling down · ${left}s`;
  }

  setInterval(renderBadge, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderBadge); else renderBadge();
})();
