(() => {
  const KEY = 'guanlao-search-state-v1';
  let restoring = false;

  function readState() {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      return s && typeof s === 'object' ? s : { query: '', game: 'All' };
    } catch {
      return { query: '', game: 'All' };
    }
  }

  function writeState(patch) {
    const next = { ...readState(), ...patch };
    try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  }

  document.addEventListener('input', event => {
    const el = event.target;
    if (el?.id === 'searchQuery') writeState({ query: el.value });
  }, true);

  document.addEventListener('change', event => {
    const el = event.target;
    if (el?.id === 'searchGame') writeState({ game: el.value || 'All' });
  }, true);

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#doSearch')) {
      const q = document.getElementById('searchQuery');
      const g = document.getElementById('searchGame');
      writeState({ query: q?.value || '', game: g?.value || 'All' });
    }
  }, true);

  function restoreSearchControls() {
    if (restoring) return;
    const input = document.getElementById('searchQuery');
    if (!input) return;
    const game = document.getElementById('searchGame');
    const state = readState();

    restoring = true;
    try {
      if (state.query && input.value !== state.query) input.value = state.query;
      if (game && state.game && game.value !== state.game) game.value = state.game;
    } finally {
      restoring = false;
    }
  }

  const observer = new MutationObserver(() => {
    requestAnimationFrame(restoreSearchControls);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      restoreSearchControls();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    restoreSearchControls();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
