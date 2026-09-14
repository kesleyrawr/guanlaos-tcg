(() => {
  const STORAGE_KEY = 'cardvault-v2';
  let searchCards = [];
  let scheduled = false;

  function readCards() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function norm(value = '') {
    return String(value).toLowerCase().replace(/[^a-z0-9ぁ-んァ-ン一-龯]/g, '');
  }

  function allKnownCards() {
    return [...searchCards, ...readCards()];
  }

  function findCard(el) {
    const name = el.querySelector('h3')?.textContent?.trim() || '';
    if (!name) return null;
    const text = el.textContent || '';
    const known = allKnownCards();
    const byName = known.filter(card => norm(card.name) === norm(name));
    if (byName.length === 1) return byName[0];
    const exactNumber = byName.find(card => card.number && text.includes(String(card.number)));
    return exactNumber || byName[0] || null;
  }

  function decorateCard(el) {
    if (!window.GUANLAO_RARITY || el.querySelector('.rarity-row')) return;
    const card = findCard(el);
    if (!card) return;
    const badge = window.GUANLAO_RARITY.badges(card);
    if (!badge) return;
    const host = el.querySelector('.details, .card-info');
    if (!host) return;
    const row = document.createElement('div');
    row.className = 'rarity-row';
    row.innerHTML = badge;
    const muted = host.querySelector('.muted, .meta');
    if (muted) muted.insertAdjacentElement('afterend', row);
    else host.querySelector('h3')?.insertAdjacentElement('afterend', row);
  }

  function decorateAll() {
    scheduled = false;
    document.querySelectorAll('.collection-item, .card').forEach(decorateCard);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(decorateAll);
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/card-search')) {
        const clone = response.clone();
        clone.json().then(data => {
          if (Array.isArray(data?.cards)) searchCards = data.cards;
          setTimeout(schedule, 0);
          setTimeout(schedule, 80);
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  const observer = new MutationObserver(schedule);
  function boot() {
    const root = document.getElementById('content') || document.body;
    observer.observe(root, { childList: true, subtree: true });
    schedule();
    setTimeout(schedule, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
