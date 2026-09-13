(() => {
  function removeHero() {
    const hero = document.querySelector('#content .hero');
    if (hero) hero.remove();
  }

  const observer = new MutationObserver(removeHero);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      removeHero();
      observer.observe(document.getElementById('content') || document.body, { childList: true, subtree: true });
    });
  } else {
    removeHero();
    observer.observe(document.getElementById('content') || document.body, { childList: true, subtree: true });
  }
})();
