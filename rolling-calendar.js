(() => {
  const items = [
    {
      date: '2026-09-01',
      endDate: '',
      month: '2026-09',
      type: 'Event',
      game: 'Pokémon',
      title: 'Pokémon Game On! promo distribution begins',
      region: 'Philippines · Official Pokémon TCG Gyms · while supplies last',
      status: 'PH confirmed',
      url: 'https://asia.pokemon-card.com/ph/archives/7879/'
    },
    {
      date: '2026-09-16',
      endDate: '',
      month: '2026-09',
      type: 'Release',
      game: 'Pokémon',
      title: '30th Celebration',
      region: 'Philippines · English',
      status: 'PH confirmed',
      url: 'https://asia.pokemon-card.com/ph/info/'
    },
    {
      date: '',
      endDate: '',
      month: '2026-10',
      type: 'Release',
      game: 'One Piece',
      title: 'Heroines Edition vol.2 [EB-05]',
      region: 'English (Asia) · exact day / PH store availability not yet confirmed',
      status: 'Asia confirmed · PH availability TBC',
      url: 'https://asia-en.onepiece-cardgame.com/products/eb05.html'
    },
    {
      date: '',
      endDate: '',
      month: '2026-10',
      type: 'Event',
      game: 'Pokémon',
      title: 'Pokémon TCG Academia: Roadshow (October)',
      region: 'Philippines · see official event schedule for venues/dates',
      status: 'PH confirmed',
      url: 'https://asia.pokemon-card.com/ph/info/'
    },
    {
      date: '2026-11-28',
      endDate: '2026-11-29',
      month: '2026-11',
      type: 'Event',
      game: 'Pokémon',
      title: 'Premier Ball League side events',
      region: 'Philippines · Game On! sticker distribution at eligible side events',
      status: 'PH confirmed',
      url: 'https://asia.pokemon-card.com/ph/archives/7879/'
    }
  ];

  let calendarFilter = 'All';

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function manilaMonthStart() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit'
    }).formatToParts(new Date());
    const year = Number(parts.find(p => p.type === 'year')?.value || new Date().getFullYear());
    const month = Number(parts.find(p => p.type === 'month')?.value || (new Date().getMonth() + 1));
    return { year, month };
  }

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  function rollingMonths(count = 12) {
    const start = manilaMonthStart();
    const out = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(Date.UTC(start.year, start.month - 1 + i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      out.push({
        key: monthKey(y, m),
        label: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' }).format(d)
      });
    }
    return out;
  }

  function dateLabel(item) {
    if (!item.date) return 'Date TBA';
    const start = new Date(`${item.date}T00:00:00+08:00`);
    const fmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
    if (!item.endDate) return fmt.format(start);
    const end = new Date(`${item.endDate}T00:00:00+08:00`);
    return `${fmt.format(start)}–${fmt.format(end)}`;
  }

  function eventCard(item) {
    const gameClass = String(item.game).toLowerCase().includes('one piece') ? 'op' : 'pk';
    return `<article class="rolling-event ${gameClass}">
      <div class="rolling-event-top">
        <span class="rolling-type">${esc(item.type)}</span>
        <span class="rolling-date">${esc(dateLabel(item))}</span>
      </div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.region)}</p>
      <div class="rolling-event-foot">
        <span class="rolling-status">${esc(item.status)}</span>
        <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Official source ↗</a>
      </div>
    </article>`;
  }

  function renderRollingCalendar() {
    const content = document.getElementById('content');
    if (!content) return;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === 'calendar'));
    const topSearch = document.querySelector('header .searchbox');
    if (topSearch) topSearch.style.display = 'none';

    const months = rollingMonths(12);
    const monthHtml = months.map(month => {
      const monthItems = items
        .filter(item => item.month === month.key)
        .filter(item => calendarFilter === 'All' || item.type === calendarFilter);
      return `<section class="rolling-month">
        <div class="rolling-month-head">
          <h2>${esc(month.label)}</h2>
          <span>${monthItems.length ? `${monthItems.length} confirmed / announced` : 'No confirmed listings yet'}</span>
        </div>
        ${monthItems.length
          ? `<div class="rolling-event-list">${monthItems.map(eventCard).join('')}</div>`
          : `<div class="rolling-empty">Nothing confirmed for this month yet. This month stays on the calendar and will be filled when official dates are announced.</div>`}
      </section>`;
    }).join('');

    content.innerHTML = `<div class="rolling-calendar-heading">
      <div>
        <h1>Release & Event Calendar</h1>
        <p class="muted">Rolling 12-month view · Philippine Time · official dates only when confirmed.</p>
      </div>
      <div class="rolling-calendar-filters">
        ${['All','Release','Event'].map(x => `<button type="button" class="secondary ${calendarFilter === x ? 'active' : ''}" data-calendar-filter="${x}">${x}</button>`).join('')}
      </div>
    </div>
    <div class="calendar-note"><b>How dates are labeled:</b> PH confirmed means an official Philippines source/date is available. Asia confirmed means the regional release is official but exact Philippines store availability may still be pending.</div>
    <div class="rolling-months">${monthHtml}</div>`;

    content.querySelectorAll('[data-calendar-filter]').forEach(btn => btn.addEventListener('click', () => {
      calendarFilter = btn.dataset.calendarFilter || 'All';
      renderRollingCalendar();
    }));
  }

  function addStyles() {
    if (document.getElementById('rollingCalendarStyles')) return;
    const style = document.createElement('style');
    style.id = 'rollingCalendarStyles';
    style.textContent = `
      .rolling-calendar-heading{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:14px;flex-wrap:wrap}
      .rolling-calendar-filters{display:flex;gap:7px;flex-wrap:wrap}
      .calendar-note{padding:11px 13px;margin:0 0 18px;border:2px solid #243b78;border-radius:9px;background:#fff4bb;color:#243b78;font-size:12px;box-shadow:3px 3px 0 #ef6b45}
      .rolling-months{display:grid;gap:20px}
      .rolling-month{border:2px solid rgba(36,59,120,.25);border-radius:12px;background:rgba(255,255,255,.72);overflow:hidden}
      .rolling-month-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;background:#fff8dd;border-bottom:1px dashed rgba(36,59,120,.28)}
      .rolling-month-head h2{margin:0;font-size:18px}.rolling-month-head span{font-size:11px;opacity:.68;text-align:right}
      .rolling-event-list{display:grid;gap:10px;padding:12px}
      .rolling-event{padding:12px 13px;border:2px solid #243b78;border-radius:10px;background:#fff;box-shadow:3px 3px 0 #f2bf45}
      .rolling-event.op{box-shadow:3px 3px 0 #ef6b45}.rolling-event-top,.rolling-event-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
      .rolling-event h3{margin:8px 0 5px}.rolling-event p{margin:0 0 9px;font-size:12px;opacity:.78}
      .rolling-type,.rolling-date,.rolling-status{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:900}
      .rolling-type{background:#243b78;color:#fff}.rolling-date{background:#fff4bb;color:#243b78;border:1px solid #243b78}.rolling-status{background:#eef3ff;color:#243b78}
      .rolling-event a{font-size:11px;font-weight:800;color:#275ea8}.rolling-empty{padding:18px 14px;color:#6d7180;font-size:12px;font-style:italic}
      @media(max-width:650px){.rolling-month-head{align-items:flex-start;flex-direction:column}.rolling-calendar-heading{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const nav = event.target?.closest?.('[data-view="calendar"]');
    if (!nav) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    renderRollingCalendar();
  }, true);

  function boot() { addStyles(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
