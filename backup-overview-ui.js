(() => {
  let currentView = 'home';

  function panel() { return document.querySelector('.backup-panel'); }

  function syncVisibility() {
    const box = panel();
    if (!box) return;
    box.style.display = currentView === 'home' ? '' : 'none';
  }

  function enhancePanel() {
    const box = panel();
    if (!box) return;
    const details = box.querySelector('details');
    const summary = details?.querySelector('summary');
    if (!details || !summary || summary.querySelector('.backup-collapse-label')) return;

    const label = document.createElement('small');
    label.className = 'backup-collapse-label';
    label.textContent = details.open ? 'Minimize ▲' : 'Expand ▼';
    summary.appendChild(label);

    const saved = localStorage.getItem('guanlao-backup-panel-open');
    if (saved === '0') details.open = false;
    if (saved === '1') details.open = true;
    label.textContent = details.open ? 'Minimize ▲' : 'Expand ▼';

    details.addEventListener('toggle', () => {
      localStorage.setItem('guanlao-backup-panel-open', details.open ? '1' : '0');
      label.textContent = details.open ? 'Minimize ▲' : 'Expand ▼';
    });
  }

  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-view]');
    if (nav) {
      currentView = nav.dataset.view || 'home';
      syncVisibility();
      return;
    }
    if (event.target?.closest?.('#hitsNavButton')) {
      currentView = 'hits';
      syncVisibility();
    }
  }, true);

  function addStyles() {
    if (document.getElementById('backupOverviewStyles')) return;
    const style = document.createElement('style');
    style.id = 'backupOverviewStyles';
    style.textContent = `
      .backup-panel details>summary{cursor:pointer;display:flex;align-items:center;gap:12px}
      .backup-panel details>summary #backupHeadline{margin-left:auto}
      .backup-collapse-label{font-weight:800;color:#243b78;white-space:nowrap}
      .backup-panel details:not([open]){padding-bottom:0}
      .backup-panel details:not([open]) summary{margin-bottom:0}
      @media(max-width:720px){.backup-panel details>summary #backupHeadline{display:none}.backup-collapse-label{margin-left:auto}}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    addStyles();
    enhancePanel();
    currentView = document.querySelector('#sideNav [data-view].active')?.dataset?.view || 'home';
    syncVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
