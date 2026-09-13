(() => {
  const STORAGE_KEY = 'cardvault-v2';
  let activeKey = null;

  function readCards() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeCards(cards) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    const sync = document.getElementById('syncStatus');
    if (sync) sync.textContent = 'Edited card saved';
  }

  function cardKey(card) {
    return `${card.id || ''}|||${card.condition || 'Near Mint'}`;
  }

  function ensureDialog() {
    let dialog = document.getElementById('editSavedCardDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'editSavedCardDialog';
    dialog.innerHTML = `
      <form method="dialog" style="min-width:min(560px,88vw);max-width:720px">
        <h2 style="margin-top:0">Edit saved card</h2>
        <p class="muted">Correct the saved details manually. Changing the card number will let the next lookup try to match the corrected card.</p>
        <div class="field"><label>Card name</label><input id="editCardName"></div>
        <div class="field"><label>Card number</label><input id="editCardNumber" placeholder="e.g. OP17-112"></div>
        <div class="field"><label>Set</label><input id="editCardSet"></div>
        <div class="field"><label>Rarity</label><input id="editCardRarity"></div>
        <div class="field"><label>Variant</label><input id="editCardVariant"></div>
        <div class="field"><label>Language</label><select id="editCardLanguage"><option>English</option><option>Japanese</option></select></div>
        <div class="field"><label>Image URL</label><input id="editCardImage" placeholder="https://..."></div>
        <div class="field"><label>Acquired price (PHP)</label><input id="editCardAcquired" type="number" min="0" step="0.01"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
          <button type="button" class="secondary" id="cancelEditSavedCard">Cancel</button>
          <button type="button" class="primary" id="saveEditSavedCard">Save changes</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#cancelEditSavedCard').onclick = () => dialog.close();
    dialog.querySelector('#saveEditSavedCard').onclick = saveEdit;
    return dialog;
  }

  function openEdit(card) {
    const dialog = ensureDialog();
    activeKey = cardKey(card);
    dialog.querySelector('#editCardName').value = card.name || '';
    dialog.querySelector('#editCardNumber').value = card.number || '';
    dialog.querySelector('#editCardSet').value = card.set || '';
    dialog.querySelector('#editCardRarity').value = card.rarity || '';
    dialog.querySelector('#editCardVariant').value = card.variant || '';
    dialog.querySelector('#editCardLanguage').value = card.language === 'Japanese' ? 'Japanese' : 'English';
    dialog.querySelector('#editCardImage').value = card.image || '';
    dialog.querySelector('#editCardAcquired').value = Number(card.acquired || 0);
    dialog.showModal();
  }

  function saveEdit() {
    const dialog = ensureDialog();
    const cards = readCards();
    const card = cards.find(c => cardKey(c) === activeKey);
    if (!card) {
      dialog.close();
      return;
    }
    card.name = dialog.querySelector('#editCardName').value.trim() || card.name;
    card.number = dialog.querySelector('#editCardNumber').value.trim() || card.number;
    card.set = dialog.querySelector('#editCardSet').value.trim();
    card.rarity = dialog.querySelector('#editCardRarity').value.trim();
    card.variant = dialog.querySelector('#editCardVariant').value.trim();
    card.language = dialog.querySelector('#editCardLanguage').value;
    card.image = dialog.querySelector('#editCardImage').value.trim();
    card.acquired = Number(dialog.querySelector('#editCardAcquired').value || 0);
    card.lastPriceCheck = null;
    card.providerId = '';
    if (card.language === 'Japanese' && String(card.game || '').toLowerCase().includes('one piece')) card.yuyuUrl = '';
    writeCards(cards);
    dialog.close();
    location.reload();
  }

  function injectButtons() {
    const cards = readCards();
    document.querySelectorAll('.collection-item').forEach(item => {
      if (item.querySelector('.edit-saved-card')) return;
      const id = item.dataset.id || '';
      const condition = item.dataset.condition || 'Near Mint';
      const card = cards.find(c => String(c.id) === id && String(c.condition || 'Near Mint') === condition);
      if (!card) return;
      const deleteBtn = item.querySelector('.delete');
      if (!deleteBtn) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary edit-saved-card';
      btn.textContent = 'Edit';
      btn.style.width = 'auto';
      btn.style.padding = '0 9px';
      btn.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        openEdit(card);
      };
      deleteBtn.before(btn);
    });
  }

  const observer = new MutationObserver(injectButtons);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureDialog();
      injectButtons();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    ensureDialog();
    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
