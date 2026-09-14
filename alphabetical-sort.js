(() => {
  const STORAGE_KEY = 'cardvault-v2';
  const nativeGet = Storage.prototype.getItem;
  const nativeSet = Storage.prototype.setItem;

  function compareCards(a = {}, b = {}) {
    const nameA = String(a.name || '').trim();
    const nameB = String(b.name || '').trim();
    const byName = nameA.localeCompare(nameB, 'en', { sensitivity: 'base', numeric: true });
    if (byName) return byName;

    const gameA = String(a.game || '');
    const gameB = String(b.game || '');
    const byGame = gameA.localeCompare(gameB, 'en', { sensitivity: 'base' });
    if (byGame) return byGame;

    const langA = String(a.language || '');
    const langB = String(b.language || '');
    const byLanguage = langA.localeCompare(langB, 'en', { sensitivity: 'base' });
    if (byLanguage) return byLanguage;

    return String(a.number || '').localeCompare(String(b.number || ''), 'en', { sensitivity: 'base', numeric: true });
  }

  function sortSerialized(value) {
    try {
      const cards = JSON.parse(value || '[]');
      if (!Array.isArray(cards)) return value;
      return JSON.stringify([...cards].sort(compareCards));
    } catch {
      return value;
    }
  }

  // Sort the existing shared collection immediately before app.js loads it.
  const existing = nativeGet.call(localStorage, STORAGE_KEY);
  if (existing) nativeSet.call(localStorage, STORAGE_KEY, sortSerialized(existing));

  // Keep every future save alphabetical too.
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && String(key) === STORAGE_KEY) {
      return nativeSet.call(this, key, sortSerialized(value));
    }
    return nativeSet.call(this, key, value);
  };

  window.GUANLAO_SORT_CARDS = compareCards;
})();
