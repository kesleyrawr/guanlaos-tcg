(() => {
  function setTopSearch(view) {
    const box = document.querySelector('header .searchbox');
    if (box) box.style.display = view === 'home' ? '' : 'none';
  }

  function syncFromActiveNav() {
    const active = document.querySelector('#sideNav [data-view].active');
    const view = active?.dataset?.view || 'home';
    setTopSearch(view);
  }

  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-view]');
    if (!nav) return;
    setTopSearch(nav.dataset.view || 'home');
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFromActiveNav);
  } else {
    syncFromActiveNav();
  }
})();
