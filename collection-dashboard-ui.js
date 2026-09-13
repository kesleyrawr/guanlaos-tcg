(() => {
  const STORAGE_KEY = 'cardvault-v2';
  const PAGE_SIZE = 20;
  const groups = [
    { key: 'Pokémon English', label: 'Pokémon English' },
    { key: 'Pokémon Japanese', label: 'Pokémon Japanese' },
    { key: 'One Piece English', label: 'One Piece English' },
    { key: 'One Piece Japanese', label: 'One Piece Japanese' }
  ];
  let selectedGroup = 'All';
  let currentPage = 1;

  function readCards() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveCards(cards, message = 'Saved on this device') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    const count = cards.reduce((sum, card) => sum + Number(card.quantity || 1), 0);
    const badge = document.getElementById('navCount');
    if (badge) badge.textContent = count;
    const sync = document.getElementById('syncStatus');
    if (sync) sync.textContent = message;
  }

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function imageUrl(card) {
    const image = String(card?.image || '');
    return image.startsWith('http') ? `/api/card-image?url=${encodeURIComponent(image)}` : image;
  }

  function groupKey(card) {
    return `${card.game || ''} ${card.language || ''}`.trim();
  }

  function filteredCards() {
    const cards = readCards();
    return selectedGroup === 'All' ? cards : cards.filter(card => groupKey(card) === selectedGroup);
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

  function collectionCard(card) {
    return `<article class="collection-item" data-id="${esc(card.id || '')}" data-condition="${esc(card.condition || 'Near Mint')}">
      ${cardArt(card)}
      <div class="details">
        <small>${esc(card.game || '')} · ${esc(card.language || '')}</small>
        <h3>${esc(card.name || 'Unknown card')}</h3>
        <div class="muted">${esc(card.number || '')} · ${esc(card.condition || 'Near Mint')}</div>
        <div class="field"><label>Acquired price</label><input class="acquired" type="number" min="0" step="0.01" value="${Number(card.acquired || 0)}"></div>
        <div class="qtyrow">
          <button class="minus">−</button>
          <b>${Number(card.quantity || 1)}</b>
          <button class="plus">+</button>
          <button class="danger delete" style="width:auto;padding:0 9px">Delete</button>
        </div>
      </div>
    </article>`;
  }

  function bindCollectionActions() {
    document.querySelectorAll('#customCollectionGrid .collection-item').forEach(el => {
      const findCard = cards => cards.find(card => card.id === el.dataset.id && (card.condition || 'Near Mint') === el.dataset.condition);

      el.querySelector('.minus')?.addEventListener('click', () => {
        const cards = readCards();
        const card = findCard(cards);
        if (!card) return;
        if (Number(card.quantity || 1) > 1) card.quantity = Number(card.quantity || 1) - 1;
        else cards.splice(cards.indexOf(card), 1);
        saveCards(cards);
        ensureValidPage();
        renderCollection();
      });

      el.querySelector('.plus')?.addEventListener('click', () => {
        const cards = readCards();
        const card = findCard(cards);
        if (!card) return;
        card.quantity = Number(card.quantity || 1) + 1;
        saveCards(cards);
        renderCollection();
      });

      el.querySelector('.delete')?.addEventListener('click', () => {
        const cards = readCards();
        const card = findCard(cards);
        if (!card) return;
        cards.splice(cards.indexOf(card), 1);
        saveCards(cards);
        ensureValidPage();
        renderCollection();
      });

      el.querySelector('.acquired')?.addEventListener('change', event => {
        const cards = readCards();
        const card = findCard(cards);
        if (!card) return;
        card.acquired = Number(event.target.value || 0);
        saveCards(cards);
      });
    });
  }

  function ensureValidPage() {
    const totalPages = Math.max(1, Math.ceil(filteredCards().length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
  }

  function setCollectionNavActive() {
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'collection'));
    document.querySelectorAll('.collection-subnav button').forEach(button => button.classList.toggle('active', button.dataset.collectionGroup === selectedGroup));
    const topSearch = document.querySelector('header .searchbox');
    if (topSearch) topSearch.style.display = 'none';
  }

  function renderCollection() {
    ensureValidPage();
    setCollectionNavActive();
    const content = document.getElementById('content');
    if (!content) return;

    const list = filteredCards();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageCards = list.slice(start, start + PAGE_SIZE);
    const title = selectedGroup === 'All' ? 'My collection' : selectedGroup;
    const firstShown = list.length ? start + 1 : 0;
    const lastShown = Math.min(start + PAGE_SIZE, list.length);

    content.innerHTML = `
      <div class="collection-page-heading">
        <div>
          <h1>${esc(title)}</h1>
          <p class="muted">${list.length} unique card${list.length === 1 ? '' : 's'} · showing ${firstShown}-${lastShown}</p>
        </div>
      </div>
      ${pageCards.length ? `<div id="customCollectionGrid" class="collection-grid">${pageCards.map(collectionCard).join('')}</div>` : `<div class="empty"><h3>No cards here yet</h3><p>Add cards through Card Search and they will appear here.</p></div>`}
      <div class="collection-pagination">
        <button class="secondary" id="collectionPrev" ${currentPage <= 1 ? 'disabled' : ''}>← Previous</button>
        <span>Page <b>${currentPage}</b> of <b>${totalPages}</b></span>
        <button class="secondary" id="collectionNext" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
      </div>`;

    document.getElementById('collectionPrev')?.addEventListener('click', () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      renderCollection();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('collectionNext')?.addEventListener('click', () => {
      if (currentPage >= totalPages) return;
      currentPage += 1;
      renderCollection();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    bindCollectionActions();
  }

  function renderOverviewCards() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    const cards = readCards();
    const sectionTitle = grid.closest('section')?.querySelector('.section-title');
    const tabs = document.getElementById('homeTabs');
    if (tabs) tabs.remove();
    if (sectionTitle) {
      const heading = sectionTitle.querySelector('h2');
      const copy = sectionTitle.querySelector('p');
      if (heading) heading.textContent = 'Explore cards';
      if (copy) copy.textContent = 'Your saved collection, newest cards included.';
    }
    if (!cards.length) {
      grid.innerHTML = '<div class="empty"><h3>No cards yet</h3><p>Add cards through Card Search and they will appear here.</p></div>';
      return;
    }
    grid.innerHTML = cards.slice(0, 20).map(card => `<article class="card">${cardArt(card)}<div class="card-info"><small>${esc(card.game || '')} · ${esc(card.language || '')}</small><h3>${esc(card.name || 'Unknown card')}</h3><div class="meta">${esc(card.number || '')} · ${esc(card.rarity || '')}</div><footer><span class="dual"><b>Qty ${Number(card.quantity || 1)}</b><small>${esc(card.condition || 'Near Mint')}</small></span><small>${esc(card.language || '')}</small></footer></div></article>`).join('');
  }

  function injectSidebar() {
    const collectionButton = document.querySelector('#sideNav [data-view="collection"]');
    if (!collectionButton || document.querySelector('.collection-subnav')) return;
    const wrap = document.createElement('div');
    wrap.className = 'collection-subnav';
    wrap.innerHTML = groups.map(group => `<button type="button" data-collection-group="${esc(group.key)}">↳ ${esc(group.label)}</button>`).join('');
    collectionButton.insertAdjacentElement('afterend', wrap);

    wrap.querySelectorAll('[data-collection-group]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        selectedGroup = button.dataset.collectionGroup || 'All';
        currentPage = 1;
        renderCollection();
      });
    });
  }

  function addStyles() {
    if (document.getElementById('collectionDashboardUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'collectionDashboardUiStyles';
    style.textContent = `
      .collection-subnav{display:grid;gap:5px;margin:-4px 8px 8px 18px;padding-left:8px;border-left:2px solid rgba(36,59,120,.28)}
      .collection-subnav button{font:700 11px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:left;padding:7px 9px;border:0;border-radius:7px;background:transparent;color:#243b78;cursor:pointer}
      .collection-subnav button:hover,.collection-subnav button.active{background:#fff4bb;box-shadow:2px 2px 0 #ef6b45}
      .collection-pagination{display:flex;justify-content:center;align-items:center;gap:14px;margin:24px 0 8px;flex-wrap:wrap}
      .collection-pagination button:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
      .collection-page-heading{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:14px}
      @media(max-width:760px){.collection-subnav{display:none}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#sideNav [data-view="collection"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectedGroup = 'All';
    currentPage = 1;
    renderCollection();
  }, true);

  document.addEventListener('click', event => {
    const home = event.target?.closest?.('[data-view="home"]');
    if (!home) return;
    setTimeout(renderOverviewCards, 0);
    setTimeout(renderOverviewCards, 80);
  }, true);

  function boot() {
    addStyles();
    injectSidebar();
    setTimeout(renderOverviewCards, 50);
    setTimeout(renderOverviewCards, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) {
      if (document.querySelector('.collection-page-heading')) renderCollection();
      renderOverviewCards();
    }
  });
})();
