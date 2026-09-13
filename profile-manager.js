(() => {
  const ACTIVE_KEY = 'guanlao-active-profile';
  const PROFILES_KEY = 'guanlao-profiles-v1';
  const BASE_COLLECTION_KEY = 'cardvault-v2';

  function readProfiles() {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILES_KEY) || 'null');
      if (Array.isArray(saved) && saved.length >= 2) return saved;
    } catch {}
    const defaults = [
      { id: 'bess', name: 'Bess' },
      { id: 'partner', name: 'Partner' }
    ];
    localStorage.setItem(PROFILES_KEY, JSON.stringify(defaults));
    return defaults;
  }

  function readCards(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function mergeLegacyProfileCollections() {
    const sources = [
      readCards(BASE_COLLECTION_KEY),
      readCards(`${BASE_COLLECTION_KEY}::bess`),
      readCards(`${BASE_COLLECTION_KEY}::partner`)
    ];
    const merged = [];
    for (const list of sources) {
      for (const raw of list) {
        const card = { ...raw };
        const condition = card.condition || 'Near Mint';
        const existing = merged.find(x => x.id === card.id && (x.condition || 'Near Mint') === condition);
        if (!existing) {
          merged.push(card);
          continue;
        }
        existing.quantity = Math.max(Number(existing.quantity || 1), Number(card.quantity || 1));
        if (!Number(existing.acquired || 0) && Number(card.acquired || 0)) existing.acquired = Number(card.acquired || 0);
        if (!existing.image && card.image) existing.image = card.image;
        if (!existing.providerId && card.providerId) existing.providerId = card.providerId;
        if (!existing.priceSource && card.priceSource) existing.priceSource = card.priceSource;
      }
    }
    if (merged.length) localStorage.setItem(BASE_COLLECTION_KEY, JSON.stringify(merged));
  }

  mergeLegacyProfileCollections();

  let profiles = readProfiles();
  let activeId = localStorage.getItem(ACTIVE_KEY) || '';

  function activeProfile() {
    return profiles.find(p => p.id === activeId) || profiles[0];
  }

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function savePartnerName(name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    profiles = profiles.map(p => p.id === 'partner' ? { ...p, name: clean } : p);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    renderLogin();
  }

  function chooseProfile(id) {
    localStorage.setItem(ACTIVE_KEY, id);
    location.reload();
  }

  function logout() {
    localStorage.removeItem(ACTIVE_KEY);
    location.reload();
  }

  function loginMarkup() {
    const partner = profiles.find(p => p.id === 'partner') || { id: 'partner', name: 'Partner' };
    return `
      <div class="profile-login-card">
        <div class="profile-login-logo">▰</div>
        <h1>GUANLAO'S TCG COLLECTOR</h1>
        <p>Choose who's using the collector.</p>
        <div class="profile-choices">
          ${profiles.map((p, index) => `<button class="profile-choice" data-profile-id="${esc(p.id)}"><span>${index === 0 ? 'BS' : 'TCG'}</span><b>${esc(p.name)}</b><small>Shared collection & backup</small></button>`).join('')}
        </div>
        ${partner.name === 'Partner' ? `<div class="partner-setup"><label>Name the second profile</label><div><input id="partnerProfileName" placeholder="Your husband's name"><button id="savePartnerProfile">Save name</button></div></div>` : ''}
        <small class="profile-login-note">Both profiles use the same collection and the same PC backup. The login only changes who is currently using the app.</small>
      </div>`;
  }

  function renderLogin() {
    let overlay = document.getElementById('profileLoginOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'profileLoginOverlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = loginMarkup();
    overlay.querySelectorAll('[data-profile-id]').forEach(btn => btn.addEventListener('click', () => chooseProfile(btn.dataset.profileId)));
    overlay.querySelector('#savePartnerProfile')?.addEventListener('click', () => savePartnerName(overlay.querySelector('#partnerProfileName')?.value));
    overlay.querySelector('#partnerProfileName')?.addEventListener('keydown', e => { if (e.key === 'Enter') savePartnerName(e.target.value); });
  }

  function decorateUi() {
    const profile = activeProfile();
    const avatar = document.querySelector('header .avatar');
    if (avatar) {
      const initials = profile.name.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
      avatar.textContent = initials || 'TC';
      avatar.title = `${profile.name} · click to switch profile`;
      avatar.addEventListener('click', logout);
    }
    const sync = document.querySelector('.aside-foot .sync small');
    if (sync && !sync.dataset.profileDecorated) {
      sync.dataset.profileDecorated = '1';
      sync.textContent = `${profile.name} · Shared collection`;
    }
    if (!document.getElementById('switchProfileButton')) {
      const foot = document.querySelector('.aside-foot');
      if (foot) {
        const button = document.createElement('button');
        button.id = 'switchProfileButton';
        button.type = 'button';
        button.textContent = `⇄ Switch profile · ${profile.name}`;
        button.addEventListener('click', logout);
        foot.insertBefore(button, foot.lastElementChild);
      }
    }
  }

  function addStyles() {
    if (document.getElementById('profileManagerStyles')) return;
    const style = document.createElement('style');
    style.id = 'profileManagerStyles';
    style.textContent = `
      #profileLoginOverlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:#f7f0db;background-image:radial-gradient(#efc771 1px,transparent 1px);background-size:18px 18px;color:#172b63;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .profile-login-card{width:min(620px,100%);padding:28px;border:3px solid #172b63;border-radius:18px;background:#fffaf0;box-shadow:9px 9px 0 #e95736;text-align:center}
      .profile-login-logo{width:58px;height:58px;margin:0 auto 10px;display:grid;place-items:center;border:3px solid #172b63;border-radius:14px;background:#ffd83d;font-size:28px;box-shadow:4px 4px 0 #e95736}
      .profile-login-card h1{margin:8px 0;font-size:25px}.profile-login-card>p{margin:0 0 20px}
      .profile-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .profile-choice{display:grid;gap:5px;justify-items:center;padding:20px 14px;border:2px solid #172b63;border-radius:14px;background:#fff;cursor:pointer;box-shadow:4px 4px 0 #f2bf45;color:#172b63}
      .profile-choice:hover{transform:translate(-1px,-1px);box-shadow:6px 6px 0 #e95736}.profile-choice span{width:46px;height:46px;display:grid;place-items:center;border-radius:50%;background:#2e68bb;color:white;font-weight:900}.profile-choice b{font-size:17px}.profile-choice small{opacity:.7}
      .partner-setup{margin-top:18px;padding-top:16px;border-top:1px dashed #9ca8c3;text-align:left}.partner-setup label{display:block;font-weight:800;margin-bottom:7px}.partner-setup div{display:flex;gap:8px}.partner-setup input{flex:1;min-width:0;padding:10px;border:2px solid #172b63;border-radius:8px}.partner-setup button{padding:10px 14px;border:2px solid #172b63;border-radius:8px;background:#ffd83d;font-weight:800;cursor:pointer}
      .profile-login-note{display:block;margin-top:18px;opacity:.65}
      #switchProfileButton{font-size:11px}
      @media(max-width:620px){.profile-choices{grid-template-columns:1fr}.profile-login-card{padding:20px}.partner-setup div{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  window.GUANLAO_PROFILE = { activeProfile, logout };

  function boot() {
    addStyles();
    if (!activeId) renderLogin();
    else decorateUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
