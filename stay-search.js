(() => {
  let pendingSearch = null;

  function rememberSearch() {
    const query = document.getElementById('searchQuery');
    if (!query) return;
    const game = document.getElementById('searchGame');
    pendingSearch = {
      query: query.value || '',
      game: game?.value || 'All',
      scrollY: window.scrollY
    };
  }

  function restoreSearch() {
    if (!pendingSearch) return;
    const state = pendingSearch;
    pendingSearch = null;

    let tries = 0;
    const restore = () => {
      const query = document.getElementById('searchQuery');
      const game = document.getElementById('searchGame');
      const button = document.getElementById('doSearch');
      if (!query || !button) {
        if (tries++ < 12) setTimeout(restore, 30);
        return;
      }
      query.value = state.query;
      if (game) game.value = state.game;
      if (state.query.trim().length >= 2) button.click();
      setTimeout(() => window.scrollTo({ top: state.scrollY, behavior: 'auto' }), 80);
    };
    setTimeout(restore, 20);
  }

  const dialogBody = document.getElementById('cardDialogBody');
  if (!dialogBody) return;

  // Capture the search state before app.js handles Add and re-renders the view.
  dialogBody.addEventListener('click', event => {
    if (event.target?.closest?.('#addCard')) rememberSearch();
  }, true);

  // app.js has already saved the card at this point. Stop the older document-level
  // reload hook, then restore the search query/results instead of going home.
  dialogBody.addEventListener('click', event => {
    if (!event.target?.closest?.('#addCard')) return;
    event.stopPropagation();
    restoreSearch();
  });
})();
