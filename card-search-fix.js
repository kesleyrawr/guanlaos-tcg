(() => {
  const STORAGE_KEY = 'cardvault-v2';
  let active = false;
  let lastQuery = '';
  let lastGame = 'All';

  function esc(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function peso(n) {
    return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(Number(n || 0));
  }
  function imageUrl(url = '') {
    return String(url).startsWith('http') ? `/api/card-image?url=${encodeURIComponent(url)}` : '';
  }
  function readCards() {
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  }
  function writeCards(cards) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    const count = cards.reduce((a,c)=>a+Number(c.quantity || 1),0);
    const badge = document.getElementById('navCount');
    if (badge) badge.textContent = count;
    const sync = document.getElementById('syncStatus');
    if (sync) sync.textContent = 'Saved from Card Search';
  }

  function setNavActive() {
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'search'));
    const topSearch = document.querySelector('header .searchbox');
    if (topSearch) topSearch.style.display = 'none';
  }

  function renderSearchPage() {
    active = true;
    setNavActive();
    const content = document.getElementById('content');
    if (!content) return;
    content.innerHTML = `
      <h1>Card search</h1>
      <p class="muted">Search by card number, name, set, or DON!! description.</p>
      <div class="search-toolbar">
        <input id="fixedSearchQuery" autocomplete="off" placeholder="Try OP17-112, DON DP-02, Luffy vs Kaido…" value="${esc(lastQuery)}">
        <select id="fixedSearchGame">
          <option${lastGame==='All'?' selected':''}>All</option>
          <option${lastGame==='Pokémon'?' selected':''}>Pokémon</option>
          <option${lastGame==='One Piece'?' selected':''}>One Piece</option>
        </select>
        <button class="primary" id="fixedDoSearch">Search</button>
      </div>
      <div id="fixedSearchStatus" class="status">Enter at least 2 characters.</div>
      <div id="fixedSearchResults" class="search-results"></div>`;

    const input = document.getElementById('fixedSearchQuery');
    const button = document.getElementById('fixedDoSearch');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
    button.addEventListener('click', runSearch);
    input.focus();
  }

  async function runSearch() {
    const input = document.getElementById('fixedSearchQuery');
    const gameEl = document.getElementById('fixedSearchGame');
    const status = document.getElementById('fixedSearchStatus');
    const box = document.getElementById('fixedSearchResults');
    if (!input || !status || !box) return;
    const q = input.value.trim();
    const game = gameEl?.value || 'All';
    lastQuery = q;
    lastGame = game;
    if (q.length < 2) { status.textContent = 'Enter at least 2 characters.'; return; }
    status.textContent = 'Searching…';
    box.innerHTML = '';
    try {
      const r = await fetch(`/api/card-search?q=${encodeURIComponent(q)}&game=${encodeURIComponent(game)}`);
      const data = await r.json();
      const cards = Array.isArray(data.cards) ? data.cards : [];
      status.textContent = cards.length ? `${cards.length} possible match${cards.length===1?'':'es'}.` : (data.message || 'No matches found.');
      box.innerHTML = cards.map((card, i) => {
        const img = imageUrl(card.image || '');
        const price = Number(card.market || 0) > 0 ? peso(card.market) : 'Price unavailable';
        return `<article class="collection-item" style="overflow:hidden">
          <div class="art" style="--c:${esc(card.color||'#355d4a')};--a:${esc(card.accent||'#d9b96c')}">${img?`<img src="${esc(img)}" alt="${esc(card.name||'Card')}" loading="lazy">`:''}</div>
          <div class="details">
            <small>${esc(card.game||'TCG')} · ${esc(card.language||'')}</small>
            <h3>${esc(card.name||'Unknown card')}</h3>
            <div class="muted">${esc(card.number||'')} · ${esc(card.set||'')}</div>
            <p><b>${price}</b></p>
            <button class="primary fixed-add-card" data-index="${i}">Add to my collection</button>
          </div>
        </article>`;
      }).join('');
      box.querySelectorAll('.fixed-add-card').forEach(btn => btn.addEventListener('click', () => addCard(cards[Number(btn.dataset.index)])));
    } catch (e) {
      status.textContent = 'Could not reach the card catalog.';
    }
  }

  function addCard(card) {
    if (!card) return;
    const cards = readCards();
    const condition = 'Near Mint';
    const existing = cards.find(c => c.id === card.id && (c.condition || 'Near Mint') === condition);
    if (existing) existing.quantity = Number(existing.quantity || 1) + 1;
    else cards.push({ condition, quantity: 1, acquired: 0, ...card });
    writeCards(cards);
    const status = document.getElementById('fixedSearchStatus');
    if (status) status.textContent = `${card.name || 'Card'} added to your collection.`;
  }

  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-view="search"]');
    if (!nav) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderSearchPage();
  }, true);

  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-view]');
    if (!nav || nav.dataset.view === 'search') return;
    active = false;
  }, true);
})();
