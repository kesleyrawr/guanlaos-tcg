(() => {
  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
  }

  function text(card = {}) {
    return `${card.rarity || ''} ${card.variant || ''} ${card.name || ''}`.trim().toLowerCase();
  }

  function game(card = {}) {
    return String(card.game || '').toLowerCase();
  }

  function classifyOnePiece(card = {}) {
    const t = text(card);
    const rarity = String(card.rarity || '').trim().toUpperCase();
    const variant = String(card.variant || '').toLowerCase();

    // Premium/special variants take priority over the base rarity.
    if (/gold(?:en)?\s*don|gold don/.test(t)) return { key:'op-golden-don', label:'GOLDEN DON!!!', title:'Golden DON!!! · Ultra Rare' };
    if (/manga/.test(t)) return { key:'op-manga', label:'MANGA', title:'Manga Rare' };
    if (/\bsp\b|special art|special card/.test(t)) return { key:'op-sp', label:'SP', title:'Special Art' };
    if (/alternate[- ]?art|alt art|\baa\b|parallel/.test(t)) return { key:'op-aa', label:'AA', title:'Alternate Art' };
    if (/treasure rare|\btr\b/.test(t)) return { key:'op-tr', label:'TR', title:'Treasure Rare' };
    if (/promo|\bpr?\b/.test(t) || rarity === 'P') return { key:'op-promo', label:'P', title:'Promo' };
    if (/manga panel/.test(t)) return { key:'op-manga-panel', label:'MANGA PANEL', title:'Manga Panels' };
    if (/character art/.test(t)) return { key:'op-character-art', label:'CHARACTER ART', title:'Character Art' };
    if (/foil|holo/.test(variant) || /foil|holo/.test(t)) return { key:'op-foil', label:'FOIL', title:'Foil / Holo Finish' };
    if (/don/.test(t) && /alternate|alt art/.test(t)) return { key:'op-don-alt', label:'DON!!! ALT', title:'Alternate-Art DON!!!' };
    if (/don/.test(t)) return { key:'op-don', label:'DON!!!', title:'Standard DON!!!' };

    const base = {
      'C':   { key:'op-c', label:'C', title:'Common' },
      'UC':  { key:'op-uc', label:'UC', title:'Uncommon' },
      'R':   { key:'op-r', label:'R', title:'Rare' },
      'L':   { key:'op-l', label:'L', title:'Leader' },
      'SR':  { key:'op-sr', label:'SR', title:'Super Rare' },
      'SEC': { key:'op-sec', label:'SEC', title:'Secret Rare' }
    };
    if (base[rarity]) return base[rarity];
    if (/secret rare/.test(t)) return base.SEC;
    if (/super rare/.test(t)) return base.SR;
    if (/leader/.test(t)) return base.L;
    if (/uncommon/.test(t)) return base.UC;
    if (/\brare\b/.test(t)) return base.R;
    if (/common/.test(t)) return base.C;
    return null;
  }

  function classifyPokemon(card = {}) {
    const t = text(card);
    const rarity = String(card.rarity || '').trim().toUpperCase();
    if (/special illustration rare|\bsir\b|special art rare|\bsar\b/.test(t)) return { key:'pk-sir', label: rarity || 'SIR', title: card.rarity || 'Special Illustration Rare' };
    if (/illustration rare|\bir\b|art rare|\bar\b/.test(t)) return { key:'pk-ir', label: rarity || 'IR', title: card.rarity || 'Illustration Rare' };
    if (/hyper rare|gold/.test(t)) return { key:'pk-hyper', label: rarity || 'HR', title: card.rarity || 'Hyper Rare' };
    if (/ultra rare|\bur\b/.test(t)) return { key:'pk-ur', label: rarity || 'UR', title: card.rarity || 'Ultra Rare' };
    if (/secret rare|\bsr\b|super rare/.test(t)) return { key:'pk-sr', label: rarity || 'SR', title: card.rarity || 'Super / Secret Rare' };
    if (/double rare|\brr\b/.test(t)) return { key:'pk-rr', label: rarity || 'RR', title: card.rarity || 'Double Rare' };
    if (/shiny/.test(t)) return { key:'pk-shiny', label: rarity || 'SHINY', title: card.rarity || 'Shiny Rare' };
    if (/uncommon/.test(t)) return { key:'pk-uc', label: rarity || 'UC', title: card.rarity || 'Uncommon' };
    if (/common/.test(t)) return { key:'pk-c', label: rarity || 'C', title: card.rarity || 'Common' };
    if (/\brare\b/.test(t) || rarity === 'R') return { key:'pk-r', label: rarity || 'R', title: card.rarity || 'Rare' };
    return card.rarity ? { key:'generic', label: card.rarity, title: card.rarity } : null;
  }

  function classify(card = {}) {
    const g = game(card);
    if (g.includes('one piece')) return classifyOnePiece(card);
    if (g.includes('pok')) return classifyPokemon(card);
    return card.rarity ? { key:'generic', label: card.rarity, title: card.rarity } : null;
  }

  function badges(card = {}) {
    const main = classify(card);
    if (!main) return '';
    return `<span class="rarity-badge rarity-${esc(main.key)}" title="${esc(main.title)}">${esc(main.label)}</span>`;
  }

  function addStyles() {
    if (document.getElementById('rarityBadgeStyles')) return;
    const style = document.createElement('style');
    style.id = 'rarityBadgeStyles';
    style.textContent = `
      .rarity-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0 8px}
      .rarity-badge{display:inline-flex;align-items:center;justify-content:center;min-height:23px;padding:3px 8px;border:2px solid #243b78;border-radius:999px;font:900 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.03em;box-shadow:2px 2px 0 rgba(36,59,120,.22);white-space:nowrap}
      .rarity-op-c,.rarity-pk-c{background:#e6e8ec;color:#414854}
      .rarity-op-uc,.rarity-pk-uc{background:#ccefd4;color:#176332}
      .rarity-op-r,.rarity-pk-r{background:#cfe6ff;color:#1753a1}
      .rarity-op-l{background:#e2d4ff;color:#6630a8}
      .rarity-op-sr,.rarity-pk-sr{background:#ffd0cc;color:#a92323}
      .rarity-op-sec,.rarity-pk-hyper{background:linear-gradient(135deg,#fff1a8,#f5bf35);color:#6e4700;border-color:#8c6200}
      .rarity-op-aa{background:#ffd6af;color:#9c4200;border-color:#a74b00}
      .rarity-op-sp{background:#ffd2ec;color:#9a1d67;border-color:#a72b73}
      .rarity-op-manga{background:#1c1c22;color:#ffd75a;border-color:#d5a900;box-shadow:2px 2px 0 #d5a900}
      .rarity-op-tr{background:#ffe3a3;color:#784900;border-color:#a26b00}
      .rarity-op-promo{background:#c9f3ed;color:#116d66;border-color:#177a70}
      .rarity-op-don{background:#f0f0f0;color:#353535;border-color:#555}
      .rarity-op-don-alt{background:#d9e7ff;color:#254b91;border-color:#31579a}
      .rarity-op-golden-don{background:linear-gradient(135deg,#fff7b8,#f2b716 52%,#fff0a0);color:#5d3c00;border-color:#9b6a00;box-shadow:2px 2px 0 #c58b00}
      .rarity-op-manga-panel{background:#eee;color:#111;border-color:#111}
      .rarity-op-character-art{background:#d7f4ff;color:#125f7a;border-color:#19708d}
      .rarity-op-foil{background:linear-gradient(135deg,#d7f7ff,#ead9ff,#fff0ca);color:#4b3b7f;border-color:#6a59a0}
      .rarity-pk-ir{background:#d9f3ff;color:#176384;border-color:#26769a}
      .rarity-pk-sir{background:linear-gradient(135deg,#e9d3ff,#ffd9ef);color:#743c8b;border-color:#7b4b91}
      .rarity-pk-rr{background:#d9e7ff;color:#264f91;border-color:#375d9e}
      .rarity-pk-ur{background:#f0dafc;color:#73368d;border-color:#804599}
      .rarity-pk-shiny{background:linear-gradient(135deg,#dffcff,#fff,#ffe1f5);color:#4e4870;border-color:#686187}
      .rarity-generic{background:#ece8ff;color:#514589}
    `;
    document.head.appendChild(style);
  }

  addStyles();
  window.GUANLAO_RARITY = { classify, badges };
})();
