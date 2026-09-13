(() => {
  function setTopSearch(view) {
    const box = document.querySelector('header .searchbox');
    if (box) box.style.display = view === 'home' ? '' : 'none';
  }

  function refreshSearchInput() {
    const input = document.getElementById('searchQuery');
    if (!input || input.dataset.nativeReset === '1') return;

    const fresh = input.cloneNode(true);
    fresh.dataset.nativeReset = '1';
    fresh.value = input.value || '';
    input.replaceWith(fresh);

    fresh.addEventListener('keydown', event => {
      if (event.key === 'Enter') document.getElementById('doSearch')?.click();
    });
  }

  function syncFromActiveNav() {
    const active = document.querySelector('#sideNav [data-view].active');
    const view = active?.dataset?.view || 'home';
    setTopSearch(view);
    if (view === 'search') requestAnimationFrame(refreshSearchInput);
  }

  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-view]');
    if (!nav) return;
    const view = nav.dataset.view;
    setTopSearch(view);
    if (view === 'search') {
      setTimeout(refreshSearchInput, 0);
      setTimeout(refreshSearchInput, 60);
    }
  }, true);

  const content = document.getElementById('content');
  if (content) {
    const observer = new MutationObserver(() => {
      const active = document.querySelector('#sideNav [data-view].active');
      const view = active?.dataset?.view || '';
      if (view === 'search') requestAnimationFrame(refreshSearchInput);
    });
    observer.observe(content, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFromActiveNav);
  } else {
    syncFromActiveNav();
  }
})();
