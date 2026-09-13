(() => {
  const STORAGE_KEY = 'cardvault-v2';
  const PAGE_SIZE = 20;
  let hitsPage = 1;
  let showingHits = false;
  let lastCards = readCards();

  function readCards() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function imageUrl(card) {
    const image = String(card?.image || '');
    return image.startsWith('http') ? `/api/card-image?url=${encodeURIComponent(image)}` : image;
  }

  function hitText(card = {}) {
    return `${card.rarity || ''} ${card.variant || ''} ${card.name || ''}`.toLowerCase();
  }

  function isHit(card = {}) {
    const text = hitText(card);
    const pokemon = String(card.game || '').toLowerCase().includes('pok');
    const onePiece = String(card.game || '').toLowerCase().includes('one piece');

    if (pokemon) {
      return /\b(ar|art rare|ir|illustration rare|sar|special art rare|sir|special illustration rare|sr|super rare|secret rare|ur|ultra rare|hyper rare|gold|shiny rare|shiny ultra rare)\b/i.test(text);
    }

    if (onePiece) {
      return /\b(manga|parallel|alternate art|alt art|secret rare|sec|sp|special card|treasure rare|wanted|super parallel)\b/i.test(text);
    }

    return /\b(secret rare|special illustration rare|alternate art|manga|parallel|ultra rare)\b/i.test(text);
  }

  function hitCards() {
    return readCards().filter(isHit);
  }

  function cardArt(card) {
    const img = imageUrl(card);
    return `<div class="art" style="--c:${esc(card.color || '#355d4a')};--a:${esc(card.accent || '#d9b96c')}">
      <small>${esc(card.game || 'TCG')}</small>
      <strong>${esc(card.name || 'Unknown')}</strong>
      <em>${esc(card.number || '')}</em>
      ${img ? `<img src="${esc(img)}" alt="${esc(card.name || 'Card')}" loading="lazy" onerror="this.remove()">` : ''}
    </div>`;
  }

  function hitCard(card) {
    return `<article class="collection-item hit-card-item">
      ${cardArt(card)}
      <div class="details">
        <small>${esc(card.game || '')} · ${esc(card.language || '')}</small>
        <h3>${esc(card.name || 'Unknown card')}</h3>
        <div class="muted">${esc(card.number || '')} · ${esc(card.rarity || card.variant || 'Hit')}</div>
        <p><b>Qty ${Number(card.quantity || 1)}</b></p>
        <span class="hit-pill">🔥 HIT</span>
      </div>
    </article>`;
  }

  function renderHits() {
    showingHits = true;
    const content = document.getElementById('content');
    if (!content) return;
    const list = hitCards();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    hitsPage = Math.min(Math.max(1, hitsPage), totalPages);
    const start = (hitsPage - 1) * PAGE_SIZE;
    const pageCards = list.slice(start, start + PAGE_SIZE);

    document.querySelectorAll('#sideNav [data-view]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.collection-subnav button').forEach(b => b.classList.remove('active'));
    document.getElementById('hitsNavButton')?.classList.add('active');
    const topSearch = document.querySelector('header .searchbox');
    if (topSearch) topSearch.style.display = 'none';

    content.innerHTML = `
      <div class="collection-page-heading">
        <div>
          <h1>🔥 Hits</h1>
          <p class="muted">Your special pulls and high-rarity cards · ${list.length} unique hit${list.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      ${pageCards.length ? `<div class="collection-grid hits-grid">${pageCards.map(hitCard).join('')}</div>` : `<div class="empty"><h3>No hits yet</h3><p>When you add a hit card, it will automatically appear here.</p></div>`}
      <div class="collection-pagination">
        <button class="secondary" id="hitsPrev" ${hitsPage <= 1 ? 'disabled' : ''}>← Previous</button>
        <span>Page <b>${hitsPage}</b> of <b>${totalPages}</b></span>
        <button class="secondary" id="hitsNext" ${hitsPage >= totalPages ? 'disabled' : ''}>Next →</button>
      </div>`;

    document.getElementById('hitsPrev')?.addEventListener('click', () => {
      if (hitsPage <= 1) return;
      hitsPage -= 1;
      renderHits();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('hitsNext')?.addEventListener('click', () => {
      if (hitsPage >= totalPages) return;
      hitsPage += 1;
      renderHits();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function injectHitsNav() {
    if (document.getElementById('hitsNavButton')) return;
    const collectionButton = document.querySelector('#sideNav [data-view="collection"]');
    if (!collectionButton) return;
    const subnav = document.querySelector('.collection-subnav');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'hitsNavButton';
    btn.className = 'hits-nav-button';
    btn.innerHTML = '<span>🔥</span> Hits <b id="hitsCount">0</b>';
    (subnav || collectionButton).insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      hitsPage = 1;
      renderHits();
    });
    updateHitsCount();
  }

  function updateHitsCount() {
    const count = hitCards().reduce((sum, card) => sum + Number(card.quantity || 1), 0);
    const badge = document.getElementById('hitsCount');
    if (badge) badge.textContent = count;
  }

  function addedHit(before, after) {
    for (const card of after) {
      if (!isHit(card)) continue;
      const old = before.find(x => x.id === card.id && (x.condition || 'Near Mint') === (card.condition || 'Near Mint'));
      if (!old || Number(card.quantity || 1) > Number(old.quantity || 1)) return card;
    }
    return null;
  }

  function celebrate(card) {
    document.getElementById('hitCelebration')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'hitCelebration';
    wrap.className = 'hit-celebration';
    const img = imageUrl(card);
    wrap.innerHTML = `
      <div class="hit-celebration-card">
        <button class="hit-close" aria-label="Close">×</button>
        <div class="hit-burst">🔥 HIT CARD! 🔥</div>
        ${img ? `<img src="${esc(img)}" alt="${esc(card.name || 'Hit card')}">` : ''}
        <h2>${esc(card.name || 'Hit card')}</h2>
        <p>${esc(card.number || '')}${card.rarity ? ` · ${esc(card.rarity)}` : ''}</p>
        <strong>Added to your Hits collection</strong>
        <button class="primary hit-open">View Hits</button>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('.hit-close')?.addEventListener('click', () => wrap.remove());
    wrap.querySelector('.hit-open')?.addEventListener('click', () => { wrap.remove(); hitsPage = 1; renderHits(); });
    setTimeout(() => wrap.classList.add('show'), 20);
    setTimeout(() => { if (wrap.isConnected) wrap.remove(); }, 6500);
  }

  function addStyles() {
    if (document.getElementById('hitsUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'hitsUiStyles';
    style.textContent = `
      .hits-nav-button{display:flex;align-items:center;gap:8px;width:calc(100% - 16px);margin:6px 8px 10px;padding:9px 11px;border:2px solid #243b78;border-radius:8px;background:#fff4bb;color:#243b78;font:800 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;box-shadow:3px 3px 0 #ef6b45}
      .hits-nav-button:hover,.hits-nav-button.active{background:#ffd95e;transform:translate(-1px,-1px);box-shadow:4px 4px 0 #ef6b45}
      .hits-nav-button b{margin-left:auto;min-width:22px;text-align:center;padding:3px 6px;border-radius:999px;background:#243b78;color:#fff}
      .hit-pill{display:inline-block;padding:5px 8px;border:2px solid #243b78;border-radius:999px;background:#ffd95e;font-weight:900;font-size:11px;box-shadow:2px 2px 0 #ef6b45}
      .hit-celebration{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:rgba(18,26,55,.58);backdrop-filter:blur(3px);opacity:0;transition:opacity .18s ease}
      .hit-celebration.show{opacity:1}
      .hit-celebration-card{position:relative;width:min(390px,92vw);padding:22px;text-align:center;border:4px solid #243b78;border-radius:18px;background:#fff8da;box-shadow:10px 10px 0 #ef6b45;animation:hitPop .38s cubic-bezier(.2,.85,.3,1.35)}
      .hit-celebration-card img{display:block;max-height:290px;max-width:210px;margin:12px auto;border:3px solid #243b78;border-radius:12px;box-shadow:5px 5px 0 #ffd95e}
      .hit-celebration-card h2{margin:8px 0 4px}.hit-celebration-card p{margin:0 0 8px}.hit-celebration-card strong{display:block;margin:8px 0 14px;color:#c84b31}
      .hit-burst{font:900 22px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#243b78;text-shadow:2px 2px 0 #ffd95e}
      .hit-close{position:absolute;right:10px;top:8px;border:0;background:transparent;font-size:28px;color:#243b78;cursor:pointer}
      @keyframes hitPop{0%{transform:scale(.72) rotate(-3deg)}70%{transform:scale(1.04) rotate(1deg)}100%{transform:scale(1) rotate(0)}}
    `;
    document.head.appendChild(style);
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    if (key !== STORAGE_KEY) return originalSetItem(key, value);
    const before = readCards();
    const result = originalSetItem(key, value);
    const after = readCards();
    const hit = addedHit(before, after);
    lastCards = after;
    updateHitsCount();
    if (showingHits) renderHits();
    if (hit) setTimeout(() => celebrate(hit), 60);
    return result;
  };

  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-view], .collection-subnav button, #hitsNavButton');
    if (!nav) return;
    if (nav.id !== 'hitsNavButton') showingHits = false;
  }, true);

  function boot() {
    addStyles();
    injectHitsNav();
    updateHitsCount();
    setTimeout(injectHitsNav, 250);
    setTimeout(injectHitsNav, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
