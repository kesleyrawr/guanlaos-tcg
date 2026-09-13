(() => {
  function applyBrand() {
    const brand = document.querySelector('aside .brand');
    if (brand && !brand.dataset.logoApplied) {
      brand.dataset.logoApplied = '1';
      brand.innerHTML = `<img class="guanlao-brand-logo" src="./app-logo.svg" alt="GUANLAO'S TCG Collector logo"><div><b>GUANLAO'S</b><small>TCG COLLECTOR</small></div>`;
    }

    const mobile = document.querySelector('.mobile-brand');
    if (mobile && !mobile.dataset.logoApplied) {
      mobile.dataset.logoApplied = '1';
      mobile.innerHTML = `<img class="guanlao-mobile-logo" src="./app-logo.svg" alt=""><b>GUANLAO'S TCG COLLECTOR</b>`;
    }

    const loginLogo = document.querySelector('.profile-login-logo');
    if (loginLogo && !loginLogo.dataset.logoApplied) {
      loginLogo.dataset.logoApplied = '1';
      loginLogo.innerHTML = `<img src="./app-logo.svg" alt="GUANLAO'S TCG Collector logo">`;
    }

    if (!document.querySelector('link[rel="icon"][data-guanlao-icon]')) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.href = './app-logo.svg';
      icon.dataset.guanlaoIcon = '1';
      document.head.appendChild(icon);
    }
  }

  function addStyles() {
    if (document.getElementById('guanlaoBrandStyles')) return;
    const style = document.createElement('style');
    style.id = 'guanlaoBrandStyles';
    style.textContent = `
      aside .brand{display:flex;align-items:center;gap:10px}
      .guanlao-brand-logo{width:48px;height:48px;object-fit:cover;border:2px solid #172b63;border-radius:10px;box-shadow:3px 3px 0 #e95736;flex:0 0 auto}
      .guanlao-mobile-logo{width:34px;height:34px;object-fit:cover;border-radius:7px;vertical-align:middle;margin-right:7px}
      .mobile-brand{display:flex;align-items:center;gap:4px}
      .profile-login-logo{width:88px!important;height:88px!important;padding:0!important;overflow:hidden;background:#111!important}
      .profile-login-logo img{width:100%;height:100%;object-fit:cover;display:block}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    addStyles();
    applyBrand();
    setTimeout(applyBrand, 120);
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#savePartnerProfile')) setTimeout(applyBrand, 30);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target?.id === 'partnerProfileName') setTimeout(applyBrand, 30);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
