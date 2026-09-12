const STORAGE_KEY = 'cardvault-v2';
const BACKUP_FILE = 'GUANLAOS-TCG-BACKUP.json';
const HANDLE_DB = 'guanlaos-tcg-backup';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'directory';

const featured = [
  {id:'pk151-168',game:'Pokémon',language:'English',name:'Charmander',set:'Scarlet & Violet—151',number:'168/165',rarity:'Illustration Rare',variant:'Holofoil',color:'#ef7a3a',accent:'#ffd866',icon:'🔥',image:'https://images.pokemontcg.io/sv3pt5/168_hires.png'},
  {id:'pk151-169',game:'Pokémon',language:'English',name:'Charmeleon',set:'Scarlet & Violet—151',number:'169/165',rarity:'Illustration Rare',variant:'Holofoil',color:'#e85d3f',accent:'#ffc85c',icon:'🔥',image:'https://images.pokemontcg.io/sv3pt5/169_hires.png'},
  {id:'pk151',game:'Pokémon',language:'English',name:'Charizard ex',set:'Scarlet & Violet—151',number:'199/165',rarity:'Special Illustration Rare',variant:'Holofoil',color:'#e85d3f',accent:'#ffb03a',icon:'🔥',image:'https://images.pokemontcg.io/sv3pt5/199_hires.png'},
  {id:'pk151jp',game:'Pokémon',language:'Japanese',name:'Charizard ex',set:'Pokémon Card 151',number:'201/165',rarity:'Special Art Rare',variant:'Holofoil',color:'#de4934',accent:'#f2d16b',icon:'🔥',image:'https://assets.tcgdex.net/ja/sv/sv03a/201/high.webp'},
  {id:'pkpe',game:'Pokémon',language:'English',name:'Iono',set:'Paldea Evolved',number:'269/193',rarity:'Special Illustration Rare',variant:'Holofoil',color:'#6b60d9',accent:'#f0d96b',icon:'⚡',image:'https://images.pokemontcg.io/sv2/269_hires.png'},
  {id:'pkshinyjp',game:'Pokémon',language:'Japanese',name:'Mew ex',set:'Shiny Treasure ex',number:'347/190',rarity:'Special Art Rare',variant:'Holofoil',color:'#e266ae',accent:'#68d9eb',icon:'✦',image:'https://assets.tcgdex.net/ja/sv/sv04a/347/high.webp'},
  {id:'pktm',game:'Pokémon',language:'English',name:'Greninja ex',set:'Twilight Masquerade',number:'214/167',rarity:'Special Illustration Rare',variant:'Holofoil',color:'#254bb3',accent:'#60d4e8',icon:'💧',image:'https://images.pokemontcg.io/sv6/214_hires.png'},
  {id:'op05',game:'One Piece',language:'English',name:'Monkey.D.Luffy',set:'Awakening of the New Era',number:'OP05-119',rarity:'Secret Rare',variant:'Manga Alternate Art',color:'#b3222f',accent:'#f6c344',icon:'☠️',image:'https://en.onepiece-cardgame.com/images/cardlist/card/OP05-119_p1.png'},
  {id:'op06',game:'One Piece',language:'English',name:'Roronoa Zoro',set:'Wings of the Captain',number:'OP06-118',rarity:'Secret Rare',variant:'Alternate Art',color:'#1e7d58',accent:'#d9bd55',icon:'⚔️',image:'https://en.onepiece-cardgame.com/images/cardlist/card/OP06-118_p1.png'},
  {id:'op01',game:'One Piece',language:'English',name:'Nami',set:'Romance Dawn',number:'OP01-016',rarity:'Rare',variant:'Parallel',color:'#de613d',accent:'#58c9df',icon:'🧭',image:'https://en.onepiece-cardgame.com/images/cardlist/card/OP01-016_p1.png'}
];

const releases = [
  {date:'2026-07-17',title:'Mega Evolution—Pitch Black',game:'Pokémon',region:'Philippines · English',url:'https://asia.pokemon-card.com/ph/info/'},
  {date:'2026-09-16',title:'30th Celebration',game:'Pokémon',region:'Philippines · English',url:'https://asia.pokemon-card.com/ph/info/'},
  {date:'2026-09-25',title:'Treasure Chest vol.2',game:'One Piece',region:'English (Asia) · PH store availability to be confirmed',url:'https://asia-en.onepiece-cardgame.com/products/tc02.html'},
  {date:'2026-10',title:'Heroines Edition vol.2 [EB-05]',game:'One Piece',region:'English (Asia) · Exact day and PH store availability to be confirmed',url:'https://asia-en.onepiece-cardgame.com/products/eb05.html'}
];

let cards = loadCards();
let quotes = {};
let currentView = 'home';
let selectedCollection = 'All';
let directoryHandle = null;
let backupTimer = null;
let priceTimer = null;
let stream = null;

function loadCards(){
  try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function normalizeCard(c){
  return {condition:'Near Mint',quantity:1,acquired:0,color:'#355d4a',accent:'#d9b96c',icon:c.game==='One Piece'?'☠':'◆',...c,quantity:Math.max(1,Number(c.quantity||1)),acquired:Number(c.acquired||0)};
}
function saveCards(message='Saved on this device'){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  document.getElementById('syncStatus').textContent = message;
  renderCounts();
  clearTimeout(backupTimer);
  backupTimer = setTimeout(()=>writePcBackup(false), 650);
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function peso(n){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(Number(n||0));}
function imageUrl(card){return card.image?.startsWith('http') ? `/api/card-image?url=${encodeURIComponent(card.image)}` : (card.image||'');}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,2600);}
function renderCounts(){
  const count=cards.reduce((a,c)=>a+Number(c.quantity||1),0);
  document.getElementById('navCount').textContent=count;
}
function art(card){
  const img=imageUrl(card);
  return `<div class="art" style="--c:${esc(card.color||'#355d4a')};--a:${esc(card.accent||'#d9b96c')}"><small>${esc(card.game||'TCG')}</small><strong>${esc(card.name||'Unknown')}</strong><em>${esc(card.number||'')}</em>${img?`<img src="${esc(img)}" alt="${esc(card.name)} ${esc(card.number)}" loading="lazy" onerror="this.remove()">`:''}</div>`;
}
function cardTile(card){
  const q=quotes[card.id];
  const price=q?.market?peso(q.market):'Price unavailable';
  return `<button class="card" data-card='${encodeURIComponent(JSON.stringify(card))}'>${art(card)}<div class="card-info"><small>${esc(card.game)} · ${esc(card.language)}</small><h3>${esc(card.name)}</h3><div class="meta">${esc(card.number)} · ${esc(card.rarity||'')}</div><footer><span class="dual"><b>${price}</b><small>${q?.market?'Updated quote':'Open for price status'}</small></span><small>${esc(card.language||'')}</small></footer></div></button>`;
}
function bindCardButtons(root=document){
  root.querySelectorAll('[data-card]').forEach(b=>b.addEventListener('click',()=>openCard(JSON.parse(decodeURIComponent(b.dataset.card)))));
}
function openCard(card){
  card=normalizeCard(card);
  const q=quotes[card.id];
  document.getElementById('cardDialogBody').innerHTML=`<div class="match-layout">${art(card)}<div><small>${esc(card.game)} · ${esc(card.language)}</small><h2>${esc(card.name)}</h2><p>${esc(card.set||'')}</p><dl><div><dt>Card no.</dt><dd>${esc(card.number)}</dd></div><div><dt>Rarity</dt><dd>${esc(card.rarity||'—')}</dd></div><div><dt>Variant</dt><dd>${esc(card.variant||'Standard')}</dd></div><div><dt>Market</dt><dd>${q?.market?peso(q.market):'No verified quote'}</dd></div></dl><div class="field"><label>Condition</label><select id="modalCondition"><option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option></select></div><div class="field"><label>Acquired price (PHP, optional)</label><input id="modalAcquired" type="number" min="0" step="0.01" value="0"></div><button class="primary" id="addCard">Add to my collection</button></div></div>`;
  document.getElementById('addCard').onclick=()=>{
    const condition=document.getElementById('modalCondition').value;
    const acquired=Number(document.getElementById('modalAcquired').value||0);
    const existing=cards.find(c=>c.id===card.id&&c.condition===condition);
    if(existing){existing.quantity+=1;if(!existing.acquired&&acquired)existing.acquired=acquired;}
    else cards.push({...card,condition,acquired,quantity:1});
    saveCards();render();document.getElementById('cardDialog').close();toast(`${card.name} added.`);
  };
  document.getElementById('cardDialog').showModal();
}

function render(){
  renderCounts();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
  if(currentView==='home') renderHome();
  else if(currentView==='collection') renderCollection();
  else if(currentView==='search') renderSearch();
  else if(currentView==='scan') renderScan();
  else if(currentView==='calendar') renderCalendar();
  else renderSettings();
}
function renderHome(){
  const priced=cards.filter(c=>quotes[c.id]?.market);
  const total=cards.reduce((a,c)=>a+(quotes[c.id]?.market||0)*c.quantity,0);
  const acquired=cards.reduce((a,c)=>a+(quotes[c.id]?.market?c.acquired*c.quantity:0),0);
  document.getElementById('content').innerHTML=`<section class="welcome"><div><label>YOUR COLLECTION</label><h1>Good day, Bess <span>✦</span></h1><p>Track every pull and know what your cards are worth.</p></div><div class="sources">◉ Automatic price checks <b>every 6 hours while open</b></div></section><section class="stats"><article><div><span>Priced collection value</span><span>◫</span></div><strong>${peso(total)}</strong><small>${cards.length-priced.length} cards without a verified quote</small></article><article><div><span>Total cards</span><span>▤</span></div><strong>${cards.reduce((a,c)=>a+c.quantity,0)}</strong><p>${cards.length} unique cards</p></article><article><div><span>Unrealized gain</span><span>▥</span></div><strong class="green">${peso(total-acquired)}</strong><p>Based on available verified quotes</p></article></section><section class="hero"><div><small>FASTEST WAY TO ADD</small><h2>Point. Scan. Collect.</h2><p>Use the camera to frame the card, then search its printed card number to confirm the exact edition.</p><button class="primary" id="heroScan">📷 Open card scanner</button></div><div class="hero-card">🃏</div></section><section><div class="section-title"><div><h2>Explore cards</h2><p>Browse Pokémon and One Piece in English and Japanese.</p></div><div class="tabs" id="homeTabs"><button class="active" data-filter="All">All</button><button data-filter="Pokémon English">Pokémon EN</button><button data-filter="Pokémon Japanese">Pokémon JP</button><button data-filter="One Piece English">One Piece EN</button><button data-filter="One Piece Japanese">One Piece JP</button></div></div><div id="featuredGrid" class="card-grid">${featured.map(cardTile).join('')}</div></section>`;
  document.getElementById('heroScan').onclick=()=>go('scan');
  document.querySelectorAll('#homeTabs button').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('#homeTabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
    const f=btn.dataset.filter;
    const list=f==='All'?featured:featured.filter(c=>`${c.game} ${c.language}`===f);
    document.getElementById('featuredGrid').innerHTML=list.map(cardTile).join('');bindCardButtons(document.getElementById('featuredGrid'));
  });
  bindCardButtons();
}
function renderCollection(){
  const groups=['All','Pokémon English','Pokémon Japanese','One Piece English','One Piece Japanese'];
  const list=selectedCollection==='All'?cards:cards.filter(c=>`${c.game} ${c.language}`===selectedCollection);
  document.getElementById('content').innerHTML=`<h1>My collection</h1><p class="muted">Your collection is stored on this device. Keep a PC backup connected for extra protection.</p><div class="collection-toolbar">${groups.map(g=>`<button class="secondary ${g===selectedCollection?'active':''}" data-group="${g}">${g}</button>`).join('')}</div>${list.length?`<div class="collection-grid">${list.map(c=>{const q=quotes[c.id];return `<article class="collection-item" data-id="${esc(c.id)}" data-condition="${esc(c.condition)}">${art(c)}<div class="details"><small>${esc(c.game)} · ${esc(c.language)}</small><h3>${esc(c.name)}</h3><div class="muted">${esc(c.number)} · ${esc(c.condition)}</div><p><b>${q?.market?peso(q.market):'No verified quote'}</b></p><div class="field"><label>Acquired price</label><input class="acquired" type="number" min="0" step="0.01" value="${Number(c.acquired||0)}"></div><div class="qtyrow"><button class="minus">−</button><b>${c.quantity}</b><button class="plus">+</button><button class="danger delete" style="width:auto;padding:0 9px">Delete</button></div></div></article>`}).join('')}</div>`:`<div class="empty"><h3>No cards here yet</h3><p>Search or scan a card, then add it to your collection.</p></div>`}`;
  document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{selectedCollection=b.dataset.group;renderCollection();});
  document.querySelectorAll('.collection-item').forEach(el=>{
    const find=()=>cards.find(c=>c.id===el.dataset.id&&c.condition===el.dataset.condition);
    el.querySelector('.minus').onclick=()=>{const c=find();if(c.quantity>1)c.quantity--;else cards=cards.filter(x=>x!==c);saveCards();renderCollection();};
    el.querySelector('.plus').onclick=()=>{find().quantity++;saveCards();renderCollection();};
    el.querySelector('.delete').onclick=()=>{const c=find();cards=cards.filter(x=>x!==c);saveCards();renderCollection();};
    el.querySelector('.acquired').onchange=e=>{find().acquired=Number(e.target.value||0);saveCards();};
  });
}
function renderSearch(){
  document.getElementById('content').innerHTML=`<h1>Card search</h1><p class="muted">Search by full name, set, or printed card number. Japanese One Piece cards are supported by the catalog service.</p><div class="search-toolbar"><input id="searchQuery" placeholder="Try OP17-112, Charizard ex, Nami…"><select id="searchGame"><option>All</option><option>Pokémon</option><option>One Piece</option></select><button class="primary" id="doSearch">Search</button></div><div id="searchStatus" class="status">Enter at least 2 characters.</div><div id="searchResults" class="search-results"></div>`;
  const run=async()=>{
    const q=document.getElementById('searchQuery').value.trim();if(q.length<2)return;
    const game=document.getElementById('searchGame').value;const st=document.getElementById('searchStatus');st.textContent='Searching…';
    try{const r=await fetch(`/api/card-search?q=${encodeURIComponent(q)}&game=${encodeURIComponent(game)}`);const data=await r.json();const result=data.cards||[];st.textContent=result.length?`${result.length} possible match${result.length===1?'':'es'}.`:(data.message||'No matches found.');const box=document.getElementById('searchResults');box.innerHTML=result.map(cardTile).join('');bindCardButtons(box);}catch{st.textContent='Could not reach the card catalog.';}
  };
  document.getElementById('doSearch').onclick=run;document.getElementById('searchQuery').onkeydown=e=>e.key==='Enter'&&run();
}
function renderScan(){
  document.getElementById('content').innerHTML=`<h1>Scan card</h1><p class="muted">Frame the card with your camera, then confirm it using the printed card number. The recovered Work build used browser OCR; this GitHub migration keeps the camera/manual confirmation flow while the OCR module is being detached.</p><div class="panel"><div id="cameraBox" class="camera-box"><div><b>Camera ready</b><p>Start the camera or upload a clear photo.</p></div></div><div class="collection-toolbar"><button id="startCamera" class="primary">📷 Start camera</button><label class="secondary">Upload photo<input id="photoInput" type="file" accept="image/*" capture="environment" hidden></label></div><div class="field"><label>Card language</label><select id="scanLanguage"><option>English</option><option>Japanese</option></select></div><div class="search-toolbar"><input id="scanNumber" placeholder="Printed number, e.g. OP17-112 or 199/165"><button class="primary" id="scanFind">Find card</button></div><div id="scanStatus" class="status">Enter the printed number to find the exact card.</div><div id="scanResults" class="search-results"></div></div>`;
  document.getElementById('startCamera').onclick=startCamera;
  document.getElementById('photoInput').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const u=URL.createObjectURL(f);document.getElementById('cameraBox').innerHTML=`<img class="preview-img" src="${u}" alt="Uploaded card photo">`;};
  const find=async()=>{const q=document.getElementById('scanNumber').value.trim();if(!q)return;const lang=document.getElementById('scanLanguage').value, st=document.getElementById('scanStatus');st.textContent='Finding exact card…';try{const r=await fetch(`/api/card-search?q=${encodeURIComponent(q)}&language=${encodeURIComponent(lang)}`);const data=await r.json();const list=data.cards||[];st.textContent=list.length?`${list.length} possible match${list.length===1?'':'es'}. Confirm artwork and edition.`:(data.message||'No match found.');const box=document.getElementById('scanResults');box.innerHTML=list.map(cardTile).join('');bindCardButtons(box);}catch{st.textContent='Could not reach the card catalog.';}};
  document.getElementById('scanFind').onclick=find;document.getElementById('scanNumber').onkeydown=e=>e.key==='Enter'&&find();
}
async function startCamera(){
  stopCamera();
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920}}});const box=document.getElementById('cameraBox');box.innerHTML='<video autoplay playsinline></video><div class="camera-guide"></div>';box.querySelector('video').srcObject=stream;}catch{toast('Camera blocked. You can upload a photo or search by number.');}
}
function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stream=null;}
function renderCalendar(){
  const now=new Date();let month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('content').innerHTML=`<h1>Release calendar</h1><p class="muted">Pokémon and One Piece releases relevant to collectors in the Philippines. Regional dates do not guarantee local store stock.</p><div class="calendar-controls"><input id="calendarMonth" type="month" value="${month}"><select id="calendarGame"><option>All</option><option>Pokémon</option><option>One Piece</option></select></div><div id="calendarBody"></div>`;
  const draw=()=>{
    const m=document.getElementById('calendarMonth').value, game=document.getElementById('calendarGame').value;const [y,mo]=m.split('-').map(Number),days=new Date(y,mo,0).getDate(),first=new Date(y,mo-1,1).getDay();const events=releases.filter(e=>e.date.startsWith(m)&&(game==='All'||e.game===game));
    let cells=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<b>${x}</b>`).join('')+Array.from({length:first},()=>'<div></div>').join('');
    for(let d=1;d<=days;d++){const date=`${m}-${String(d).padStart(2,'0')}`;cells+=`<div><b>${d}</b>${events.filter(e=>e.date===date).map(e=>`<a target="_blank" rel="noreferrer" href="${e.url}">${esc(e.game)}: ${esc(e.title)}</a>`).join('')}</div>`;}
    document.getElementById('calendarBody').innerHTML=`<div class="release-grid">${cells}</div><h2>This month</h2>${events.length?events.map(e=>`<article class="release-event"><b>${esc(e.date.length===7?'Day to be announced':e.date)} · ${esc(e.game)}</b><h3>${esc(e.title)}</h3><p>${esc(e.region)}</p><a target="_blank" rel="noreferrer" href="${e.url}">Official release announcement ↗</a></article>`).join(''):'<p>No verified releases listed for this month.</p>'}<p class="muted">Schedule data carried over from the recovered September 12, 2026 build.</p>`;
  };
  document.getElementById('calendarMonth').onchange=draw;document.getElementById('calendarGame').onchange=draw;draw();
}
function renderSettings(){
  document.getElementById('content').innerHTML=`<h1>Settings</h1><div class="panel"><h3>Storage & migration</h3><p>Collection data is saved in this browser under the current site origin. If you are moving from the old chatgpt.site version, use Restore backup once to bring your collection over.</p><p><b>Backup file:</b> ${BACKUP_FILE}</p><button class="secondary" id="settingsConnect">Connect / change PC backup folder</button></div>`;
  document.getElementById('settingsConnect').onclick=connectBackupFolder;
}
function go(view){stopCamera();currentView=view;render();window.scrollTo({top:0,behavior:'smooth'});}

async function refreshPrices(){
  if(!cards.length)return;
  try{const r=await fetch('/api/prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cards})});if(!r.ok)return;const data=await r.json();quotes={...quotes,...(data.quotes||{})};render();}catch{}
}

function openHandleDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(HANDLE_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(HANDLE_STORE))req.result.createObjectStore(HANDLE_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function storeHandle(handle){const db=await openHandleDb();await new Promise((resolve,reject)=>{const tx=db.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).put(handle,HANDLE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();}
async function loadHandle(){const db=await openHandleDb();const h=await new Promise((resolve,reject)=>{const tx=db.transaction(HANDLE_STORE,'readonly');const req=tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});db.close();return h;}
async function hasPermission(h){if(!h)return false;try{return await h.queryPermission({mode:'readwrite'})==='granted'}catch{return false}}
function backupPayload(){return {app:'guanlaos-tcg-collector',version:1,savedAt:new Date().toISOString(),cards};}
async function connectBackupFolder(){
  if(!window.showDirectoryPicker){toast('Automatic folder backup needs Chrome or Edge desktop.');return;}
  try{const h=await showDirectoryPicker({mode:'readwrite'});if(await h.requestPermission({mode:'readwrite'})!=='granted')throw Error('Permission not granted');directoryHandle=h;await storeHandle(h);updateBackupUi();await writePcBackup(true);}catch(e){if(e.name!=='AbortError')toast('Could not connect the backup folder.');}
}
async function writePcBackup(force=false){
  if(!cards.length&&!force)return;
  if(!directoryHandle||!(await hasPermission(directoryHandle))){updateBackupUi();return;}
  try{document.getElementById('backupStatus').textContent='Writing backup…';const fh=await directoryHandle.getFileHandle(BACKUP_FILE,{create:true});const w=await fh.createWritable();await w.write(JSON.stringify(backupPayload(),null,2));await w.close();const stamp=new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Manila'}).format(new Date());localStorage.setItem('guanlao-last-backup',stamp);document.getElementById('lastBackup').textContent=`${stamp} Philippine Time`;document.getElementById('backupStatus').textContent=`Saved ${cards.reduce((a,c)=>a+c.quantity,0)} cards to ${BACKUP_FILE} · overwritten`;document.getElementById('backupHeadline').textContent='Automatic backup enabled';}catch{document.getElementById('backupStatus').textContent='Backup failed. Reconnect the folder.';}
}
function updateBackupUi(){
  document.getElementById('backupFolder').textContent=directoryHandle?.name||'Not connected';document.getElementById('lastBackup').textContent=localStorage.getItem('guanlao-last-backup')||'—';document.getElementById('backupHeadline').textContent=directoryHandle?'Reconnect permission if needed':'Automatic backup not connected';
}
function downloadBackup(){const blob=new Blob([JSON.stringify(backupPayload(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=BACKUP_FILE;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function mergeCards(incoming){for(const raw of incoming){const c=normalizeCard(raw);const existing=cards.find(x=>x.id===c.id&&x.condition===c.condition);if(existing){existing.quantity=Math.max(existing.quantity,c.quantity);if(!existing.acquired&&c.acquired)existing.acquired=c.acquired;}else cards.push(c);}}
async function restoreFile(file){try{const data=JSON.parse(await file.text());if(!Array.isArray(data.cards))throw Error();if(!confirm(`Restore ${data.cards.length} card entries and merge them with your current collection?`))return;mergeCards(data.cards);saveCards('Backup restored');render();toast('Backup restored and merged.');}catch{toast('Invalid backup file.');}}

function clock(){const el=document.getElementById('clock');el.innerHTML=`${new Intl.DateTimeFormat('en-PH',{dateStyle:'full',timeStyle:'medium',timeZone:'Asia/Manila'}).format(new Date())}<span>Philippine Time · UTC+8</span>`;}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
document.getElementById('scanTop').onclick=()=>go('scan');
document.getElementById('globalSearch').onkeydown=e=>{if(e.key==='Enter'){go('search');setTimeout(()=>{document.getElementById('searchQuery').value=e.target.value;document.getElementById('doSearch').click()},0)}};
document.getElementById('connectBackup').onclick=connectBackupFolder;
document.getElementById('backupNow').onclick=()=>writePcBackup(true);
document.getElementById('downloadBackup').onclick=downloadBackup;
document.getElementById('restoreInput').onchange=e=>e.target.files?.[0]&&restoreFile(e.target.files[0]);
setInterval(clock,1000);clock();
(async()=>{try{directoryHandle=await loadHandle()}catch{}updateBackupUi();if(directoryHandle&&await hasPermission(directoryHandle))writePcBackup(true);})();
render();refreshPrices();priceTimer=setInterval(refreshPrices,6*60*60*1000);
window.addEventListener('beforeunload',stopCamera);
