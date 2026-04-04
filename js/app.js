let entries = [];
let editingId = null;
let deletingId = null;
let activeFilter = 'ALL';
let currentMode = 'dashboard';
let authTarget = null;

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── FIREBASE SETUP ───────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: atob("QUl6YVN5QVV2VU51WmhtTEZ0YllMQXVFWkV1ZEZqZGJ0NllwV1kw"),
  authDomain: "ac-fault-app-458da.firebaseapp.com",
  projectId: "ac-fault-app-458da",
  storageBucket: "ac-fault-app-458da.firebasestorage.app",
  messagingSenderId: "877320933393",
  appId: "1:877320933393:web:72c09a5d1eb3ed8d1921b0"
};

// Initialize Firebase (using the compat libraries you added to the head)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const entriesCol = db.collection('faults');

// ── API ──────────────────────────────────────────────────────────────────
async function apiGet() {
  const snapshot = await entriesCol.get();
  let results = [];
  snapshot.forEach(doc => {
    results.push({ ...doc.data(), id: doc.id });
  });
  return results;
}

async function apiPost(entry) {
  delete entry.id;
  const docRef = await entriesCol.add(entry);
  return { ...entry, id: docRef.id };
}

async function apiPut(id, entry) {
  delete entry.id;
  await entriesCol.doc(id).update(entry);
  return { ...entry, id: id };
}

async function apiDelete(id) {
  await entriesCol.doc(id).delete();
}

// ── RENDER ───────────────────────────────────────────────────────────────
function render() {
  const openCards = Array.from(document.querySelectorAll('.entry-card.open')).map(c => c.id);
  const q = document.getElementById('searchInput').value.toLowerCase();
  const list = document.getElementById('entriesList');
  const empty = document.getElementById('emptyState');

  let filtered = entries.filter(e => {
    const matchFilter = activeFilter === 'ALL' || e.type === activeFilter;
    const matchSearch = !q
      || e.code.includes(q)
      || e.title.toLowerCase().includes(q)
      || e.reasons.join(' ').toLowerCase().includes(q)
      || e.steps.join(' ').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  document.getElementById('statTotal').textContent = entries.length;
  document.getElementById('statFault').textContent = entries.filter(e => e.type === 'FAULT').length;
  document.getElementById('statWarn').textContent = entries.filter(e => e.type === 'WARNING').length;
  document.getElementById('footerCount').textContent = entries.length + ' entries | FIREBASE';

  if (!filtered.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  list.innerHTML = filtered.map(e => {
    const isFault = e.type === 'FAULT';
    const tTitle = appLang === 'hi' && e._hi_title ? e._hi_title : e.title;
    const tNote = appLang === 'hi' && e._hi_note ? e._hi_note : e.note;
    const tReasons = appLang === 'hi' && e._hi_reasons ? e._hi_reasons : e.reasons;
    const tSteps = appLang === 'hi' && e._hi_steps ? e._hi_steps : e.steps;

    const isManage = currentMode === 'management';

    const reasonsHTML = tReasons.map((r, i) => `
        <li>
          <span class="inline-text">${escapeHTML(r)}</span>
        </li>`).join('') + (isManage && appLang === 'en' ? `
        <li class="inline-add-row" style="border:none !important">
          <input type="text" placeholder="+ Add reason (Enter to save)" class="inline-add-inp" onkeydown="addInline(event, '${e.id}', 'reasons')">
        </li>` : '');

    const stepsHTML = tSteps.map((s, i) => `
        <li>
          <span class="step-num ${isFault ? 'fault-color' : ''}">${i + 1}</span>
          <span class="inline-text">${escapeHTML(s)}</span>
        </li>`).join('') + (isManage && appLang === 'en' ? `
        <li class="inline-add-row" style="border:none !important">
          <span class="step-num ${isFault ? 'fault-color' : ''}">+</span>
          <input type="text" placeholder="+ Add step (Enter to save)" class="inline-add-inp" onkeydown="addInline(event, '${e.id}', 'steps')">
        </li>` : '');
    const noteHTML = tNote ? `<div class="note-box">⚠️ ${escapeHTML(tNote)}</div>` : '';

    return `
        <div class="entry-card type-${e.type}" id="card-${e.id}">
          <div class="entry-head" onclick="toggleCard('${e.id}')">
            <span class="type-pill">${appLang === 'hi' && e.type === 'FAULT' ? 'दोष' : appLang === 'hi' ? 'चेतावनी' : e.type}</span>
            <span class="entry-code">${escapeHTML(e.code)}</span>
            <span class="entry-title">${escapeHTML(tTitle)}</span>
            <span class="entry-toggle">▼</span>
          </div>
          <div class="entry-body">
            <div class="body-grid">
              <div class="body-section">
                <h4>${appLang === 'hi' ? 'संभावित कारण' : 'Why it happens'}</h4>
                <ul class="reasons-list">${reasonsHTML}</ul>
              </div>
              <div class="body-section">
                <h4>${appLang === 'hi' ? 'सुधारात्मक कदम' : 'How to fix'}</h4>
                <ul class="steps-list">${stepsHTML}</ul>
              </div>
            </div>
            ${noteHTML}
            <div class="card-actions mana-only">
              <button class="btn-sm btn-edit" onclick="editEntry('${e.id}')">Edit</button>
              <button class="btn-sm btn-del"  onclick="deleteEntry('${e.id}')">Delete</button>
            </div>
          </div>
        </div>`;
  }).join('');

  document.querySelector('.stat-all label').textContent = appLang === 'hi' ? 'कुल प्रविष्टियां' : 'All Issues';
  document.querySelector('.stat-fault label').textContent = appLang === 'hi' ? 'दोष' : 'Faults';
  document.querySelector('.stat-warn label').textContent = appLang === 'hi' ? 'चेतावनियां' : 'Warnings';
  document.getElementById('searchInput').placeholder = appLang === 'hi' ? 'कोड, शीर्षक, कारण खोजें...' : 'Search faults, codes, or actions...';

  document.querySelector('#tab-dashboard .tab-text').textContent = appLang === 'hi' ? 'डैशबोर्ड' : 'Dashboard';
  document.querySelector('#tab-management .tab-text').textContent = appLang === 'hi' ? 'एडमिन पैनल' : 'Admin Panel';
  document.querySelector('#tab-ai .tab-text').textContent = appLang === 'hi' ? 'स्मार्ट सहायक' : 'Smart Assistant';
  document.querySelector('#tab-about .tab-text').textContent = appLang === 'hi' ? 'ऐप के बारे में' : 'About App';

  openCards.forEach(id => {
    const card = document.getElementById(id);
    if (card) card.classList.add('open');
  });
}

function toggleCard(id) {
  document.getElementById('card-' + id).classList.toggle('open');
}

// ── FILTER ───────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active', 'fault-active', 'warn-active'));
    const f = btn.dataset.filter;
    activeFilter = f;
    if (f === 'FAULT') btn.classList.add('fault-active');
    else if (f === 'WARNING') btn.classList.add('warn-active');
    else btn.classList.add('active');
    render();
  });
});
document.getElementById('searchInput').addEventListener('input', render);

// ── MODAL ────────────────────────────────────────────────────────────────
function getDynamicValues(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input`)).map(inp => inp.value.trim()).filter(Boolean);
}

function addDynamicRow(containerId, value = '') {
  const isReason = containerId === 'fReasonsContainer';
  const container = document.getElementById(containerId);
  const row = document.createElement('div');
  row.className = 'dynamic-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.placeholder = isReason ? 'Enter a possible reason...' : 'Enter an action step...';

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (input.value.trim() !== '') {
        e.preventDefault();
        const newRow = addDynamicRow(containerId);
        newRow.querySelector('input').focus();
      }
    }
  });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'del-row-btn';
  delBtn.innerHTML = '✕';
  delBtn.onclick = () => { if (container.children.length > 1) row.remove(); else input.value = ''; };

  row.appendChild(input);
  row.appendChild(delBtn);
  container.appendChild(row);
  return row;
}

function openModal(entry) {
  editingId = entry ? entry.id : null;
  document.getElementById('modalTitle').textContent = appLang === 'hi' ? 'प्रविष्टि संपादित करें' : (entry ? 'Edit Issue' : 'Add New Issue');
  document.getElementById('fCode').value = entry ? entry.code : '';
  document.getElementById('fType').value = entry ? entry.type : 'FAULT';
  document.getElementById('fTitle').value = entry ? entry.title : '';

  document.getElementById('fReasonsContainer').innerHTML = '';
  document.getElementById('fStepsContainer').innerHTML = '';
  if (entry && entry.reasons && entry.reasons.length) entry.reasons.forEach(r => addDynamicRow('fReasonsContainer', r));
  else addDynamicRow('fReasonsContainer');

  if (entry && entry.steps && entry.steps.length) entry.steps.forEach(s => addDynamicRow('fStepsContainer', s));
  else addDynamicRow('fStepsContainer');

  document.getElementById('fNote').value = entry ? (entry.note || '') : '';
  updateModalLabels();
  document.getElementById('modalOverlay').classList.add('show');
}

function updateModalLabels() {
  document.getElementById('modalTitle').textContent = editingId
    ? (appLang === 'hi' ? 'प्रविष्टि संपादित करें' : 'Edit Issue')
    : (appLang === 'hi' ? 'नई प्रविष्टि जोड़ें' : 'Add New Issue');
  document.querySelector('#fCode').previousElementSibling.textContent = appLang === 'hi' ? 'दोष / चेतावनी कोड *' : 'Fault / Warning Code *';
  document.getElementById('fCode').placeholder = appLang === 'hi' ? 'जैसे 1805' : 'e.g. 1805';
  document.querySelector('#fType').previousElementSibling.textContent = appLang === 'hi' ? 'प्रकार *' : 'Type *';
  document.querySelector('#fTitle').previousElementSibling.textContent = appLang === 'hi' ? 'शीर्षक / विवरण *' : 'Title / Description *';
  document.getElementById('fTitle').placeholder = appLang === 'hi' ? 'जैसे कंसोल A AC - प्रेशर टेस्ट के लिए कोई प्रेशर नहीं' : 'e.g. CONSOLE A AC - NO PRESSURE FOR PRESSURE TEST';
  document.querySelector('#fReasonsContainer').previousElementSibling.textContent = appLang === 'hi' ? 'संभावित कारण' : 'Why it happens';
  document.querySelector('#fStepsContainer').previousElementSibling.textContent = appLang === 'hi' ? 'कार्रवाई चरण' : 'How to fix';
  document.querySelector('#fNote').previousElementSibling.textContent = appLang === 'hi' ? 'सुरक्षा नोट (वैकल्पिक)' : 'Safety Note (optional)';
  document.querySelector('#fNote').placeholder = appLang === 'hi' ? 'जैसे उचित PPE और सुरक्षा का उपयोग करें' : 'e.g. USE PROPER PPE AND SAFETY';
  document.querySelectorAll('.add-row-btn')[0].textContent = appLang === 'hi' ? '+ कारण जोड़ें' : '+ Add Reason';
  document.querySelectorAll('.add-row-btn')[1].textContent = appLang === 'hi' ? '+ कार्रवाई जोड़ें' : '+ Add Step';
  document.querySelectorAll('.btn-cancel')[0].textContent = appLang === 'hi' ? 'रद्द करें' : 'Cancel';
  document.querySelector('.btn-save').textContent = appLang === 'hi' ? 'सहेजें' : 'Save Issue';
  document.querySelector('.form-note').innerHTML = appLang === 'hi'
    ? 'कारण या कार्रवाई चरण टाइप करें, फिर <strong>Enter</strong> दबाएं तुरंत एक नई पंक्ति जोड़ने के लिए!'
    : 'Type a reason or action step, then press <strong>Enter</strong> to quickly add a new line!';
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('show'); editingId = null; }
function overlayClick(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

async function addInline(e, id, field) {
  if (e.key === 'Enter' || e.key === 'Tab') {
    const val = e.target.value.trim();
    if (!val) return;

    e.preventDefault();
    if (appLang === 'hi') return;

    const entry = entries.find(x => x.id === id);
    if (!entry) return;

    entry[field].push(val);
    e.target.disabled = true;
    try {
      await apiPut(id, { ...entry });
    } catch (err) {
      entry[field].pop();
      showToast('✕ SAVE ERROR', '#e05c2a');
    }

    render();
    setTimeout(() => {
      const card = document.getElementById('card-' + id);
      if (card) {
        card.classList.add('open');
        const inputs = card.querySelectorAll(field === 'reasons' ? '.reasons-list .inline-add-inp' : '.steps-list .inline-add-inp');
        if (inputs.length) inputs[0].focus();
      }
    }, 50);
  }
}

async function saveEntry() {
  const code = document.getElementById('fCode').value.trim();
  const type = document.getElementById('fType').value;
  const title = document.getElementById('fTitle').value.trim();
  const reasons = getDynamicValues('fReasonsContainer');
  const steps = getDynamicValues('fStepsContainer');
  const note = document.getElementById('fNote').value.trim();

  if (!code || !title) { showToast('Code and Title are required!', '#e05c2a'); return; }

  const isDuplicate = entries.some(e => e.code === code && e.id !== editingId);
  if (isDuplicate) { showToast('⚠ CODE ALREADY EXISTS', '#e05c2a'); return; }

  showLoading(true);
  try {
    if (editingId) {
      const updated = await apiPut(editingId, { code, type, title, reasons, steps, note });
      const idx = entries.findIndex(e => e.id === editingId);
      entries[idx] = updated;
      showToast('✓ ENTRY UPDATED');
    } else {
      const created = await apiPost({ code, type, title, reasons, steps, note });
      entries.push(created);
      showToast('✓ ENTRY SAVED');
    }
    render(); closeModal();
  } catch { showToast('✕ SERVER ERROR', '#e05c2a'); }
  showLoading(false);
}

function editEntry(id) { openModal(entries.find(x => x.id === id)); }

function toggleMenu() {
  document.getElementById('sideMenu').classList.toggle('show');
  document.getElementById('sideMenuOverlay').classList.toggle('show');
}

function switchTab(mode) {
  document.getElementById('sideMenu').classList.remove('show');
  document.getElementById('sideMenuOverlay').classList.remove('show');
  if (mode === 'management') {
    if (currentMode === 'management') return;
    authTarget = 'management';
    document.getElementById('authTitle').textContent = 'ADMIN ACCESS';
    document.getElementById('authLabel').textContent = 'ENTER ADMIN KEY FOR MANAGEMENT';
    document.getElementById('authKey').value = '';
    document.getElementById('authOverlay').classList.add('show');
    setTimeout(() => document.getElementById('authKey').focus(), 50);
    return;
  }

  document.getElementById('tab-dashboard').classList.remove('active');
  document.getElementById('tab-management').classList.remove('active');
  document.getElementById('tab-about').classList.remove('active');
  document.getElementById('tab-ai').classList.remove('active');

  if (mode === 'about') {
    currentMode = 'about';
    document.body.classList.remove('mode-management', 'mode-ai');
    document.body.classList.add('mode-about');
    document.getElementById('tab-about').classList.add('active');
  } else if (mode === 'ai') {
    currentMode = 'ai';
    document.body.classList.remove('mode-management', 'mode-about');
    document.body.classList.add('mode-ai');
    document.getElementById('tab-ai').classList.add('active');
    updateKeyIndicator();
  } else {
    currentMode = 'dashboard';
    document.body.classList.remove('mode-management', 'mode-about', 'mode-ai');
    document.getElementById('tab-dashboard').classList.add('active');
  }
}

function deleteEntry(id) {
  deletingId = id;
  authTarget = 'delete';
  document.getElementById('authTitle').textContent = 'SECURITY CHECK';
  document.getElementById('authLabel').textContent = 'ENTER ADMIN KEY TO AUTHORIZE';
  document.getElementById('authKey').value = '';
  document.getElementById('authOverlay').classList.add('show');
  setTimeout(() => document.getElementById('authKey').focus(), 50);
}

function closeAuth() {
  document.getElementById('authOverlay').classList.remove('show');
  deletingId = null;
  authTarget = null;
}

async function submitAuth() {
  const pin = document.getElementById('authKey').value;
  if (pin !== 'tata@1234') {
    showToast('✕ INCORRECT KEY', '#e05c2a');
    document.getElementById('authKey').value = '';
    return;
  }

  const target = authTarget;
  closeAuth();

  if (target === 'management') {
    currentMode = 'management';
    document.body.classList.remove('mode-about');
    document.body.classList.add('mode-management');
    document.getElementById('tab-dashboard').classList.remove('active');
    document.getElementById('tab-about').classList.remove('active');
    document.getElementById('tab-management').classList.add('active');
    showToast('✓ ADMIN MODE UNLOCKED', 'var(--accent)');
  } else if (target === 'delete') {
    const id = deletingId;
    showLoading(true);
    try {
      await apiDelete(id);
      entries = entries.filter(e => e.id !== id);
      render(); showToast('✓ ENTRY DELETED', '#e05c2a');
    } catch { showToast('✕ SERVER ERROR', '#e05c2a'); }
    showLoading(false);
  }
}

// ── CSV EXPORT ───────────────────────────────────────────────────────────
function exportCSV() {
  if (!entries.length) return showToast('No entries to export', '#e05c2a');

  const headers = ['Code', 'Type', 'Title', 'Reasons', 'Steps', 'Note'];
  const csvRows = [headers.join(',')];

  for (const e of entries) {
    const row = [
      `"${e.code}"`,
      `"${e.type}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.reasons.join('; ').replace(/"/g, '""')}"`,
      `"${e.steps.join('; ').replace(/"/g, '""')}"`,
      `"${(e.note || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ac_faults_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ── TOAST / LOADING ──────────────────────────────────────────────────────
function showToast(msg, bg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = bg || 'var(--safe)';
  t.style.color = bg ? '#fff' : '#000';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

// ── SMART WAKEUP LOADER ──────────────────────────────────────────────────
function setLoader(title, sub, tip, barPct) {
  document.getElementById('loadingTitle').textContent = title;
  document.getElementById('loadingSub').textContent = sub;
  document.getElementById('loadingTip').innerHTML = tip;
  document.getElementById('loadingBar').style.width = barPct + '%';
}

// ── GEO-FENCE SETTINGS ───────────────────────────────────────────────────
const PLANT_LAT = 26.911437; // Tata Motors Lucknow Plant Approx
const PLANT_LON = 81.058927;
const MAX_RADIUS_KM = 10; // Allowed radius in km

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── TRANSLATION ENGINE ───────────────────────────────────────────────────
let appLang = 'en';
const transCache = {};

async function toggleLang() {
  appLang = appLang === 'en' ? 'hi' : 'en';
  document.getElementById('langToggle').textContent = appLang === 'en' ? 'A / अ' : 'अ / A';

  if (appLang === 'hi') {
    showLoading(true);
    document.getElementById('loadingTitle').textContent = 'अनुवाद हो रहा है...';
    document.getElementById('loadingSub').textContent = 'Translating technical context...';

    const toTranslate = new Set();
    entries.forEach(e => {
      if (!e._hi_title) toTranslate.add(e.title);
      if (e.note && !e._hi_note) toTranslate.add(e.note);
      e.reasons.forEach(r => { if (!transCache[r]) toTranslate.add(r); });
      e.steps.forEach(s => { if (!transCache[s]) toTranslate.add(s); });
    });

    const chunk = Array.from(toTranslate);
    if (chunk.length > 0) {
      for (let i = 0; i < chunk.length; i += 4) {
        const slice = chunk.slice(i, i + 4);
        await Promise.all(slice.map(async text => {
          try {
            const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`);
            if (!res.ok) throw new Error('Translation API error');
            const j = await res.json();
            let out = '';
            if (j[0]) j[0].forEach(p => { if (p[0]) out += p[0]; });
            if (out) transCache[text] = out;
          } catch (err) {
            console.warn('Translation failed for:', text);
          }
        }));
      }
    }

    entries.forEach(e => {
      if (e.title) e._hi_title = transCache[e.title] || e.title;
      if (e.note) e._hi_note = transCache[e.note] || e.note;
      if (e.reasons) e._hi_reasons = e.reasons.map(r => transCache[r] || r);
      if (e.steps) e._hi_steps = e.steps.map(s => transCache[s] || s);
    });

    showLoading(false);
  }

  render();
}

// ── HELPER: SHOW ACCESS DENIED UI ─────────────────────────────────────────
function showAccessDenied(title, sub, tip) {
  setLoader(title, sub, tip, 100);
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.background = 'radial-gradient(circle at center, rgba(60, 0, 0, 0.98), rgba(0, 0, 0, 0.98))';
  document.getElementById('loadingTitle').style.color = 'var(--fault)';
  document.getElementById('loadingBar').style.background = 'var(--fault)';
  const lb = document.querySelector('.loading-box');
  if (lb) {
    lb.style.border = '2px solid var(--fault)';
    lb.style.boxShadow = '0 0 30px rgba(255, 68, 68, 0.5)';
  }
  const sp = document.querySelector('.spinner');
  if (sp) {
    sp.style.borderTopColor = 'var(--fault)';
    sp.style.animation = 'none';
    sp.style.transform = 'rotate(45deg)';
  }
}

// ── INIT ─────────────────────────────────────────────────────────────────
async function init() {
  setLoader('CHECKING GPS...', 'Locating device...', 'Please allow location', 20);

  try {
    let pos = null;
    try {
      pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0
        });
      });
    } catch (geoErr) {
      showAccessDenied('ACCESS DENIED', 'Location permission is required to access this system.', 'Please enable GPS and refresh the page.');
      return;
    }

    if (pos) {
      const dist = getDistance(pos.coords.latitude, pos.coords.longitude, PLANT_LAT, PLANT_LON);
      if (dist > MAX_RADIUS_KM) {
        showAccessDenied('ACCESS DENIED', `System Locked: You are ${dist.toFixed(1)}km away`, 'Contact: <a href="mailto:gkk468971@tatamotors.com" style="color:var(--accent);text-decoration:underline;">Govind Kumar</a>');
        return;
      }
    } else {
      // In case pos is null for an unknown reason without throwing
      showAccessDenied('ACCESS DENIED', 'Location sensor unavailable.', 'Please use a device with GPS capabilities.');
      return;
    }

    setLoader('LOADING DATA...', 'Connecting to server...', '', 60);
    entries = await apiGet();
    render();
    setLoader('DONE', '', '', 100);
    setTimeout(() => showLoading(false), 400);

  } catch (e) {
    console.error(e);
    setLoader('SYSTEM ERROR', 'Could not fetch data', 'Contact: <a href="mailto:gkk468971@tatamotors.com" style="color:var(--accent);text-decoration:underline;">Govind Kumar</a>', 100);
    document.getElementById('loadingOverlay').style.background = 'radial-gradient(circle at center, rgba(60, 0, 0, 0.98), rgba(0, 0, 0, 0.98))';
    document.getElementById('loadingTitle').style.color = 'var(--fault)';
    document.getElementById('loadingBar').style.background = 'var(--fault)';
    const lb = document.querySelector('.loading-box');
    if (lb) { lb.style.border = '2px solid var(--fault)'; lb.style.boxShadow = '0 0 30px rgba(255, 68, 68, 0.5)'; }
    const sp = document.querySelector('.spinner');
    if (sp) { sp.style.borderTopColor = 'var(--fault)'; sp.style.animation = 'none'; sp.style.transform = 'rotate(45deg)'; }
  }
}
init();

// ── AI PDF ASSISTANT ─────────────────────────────────────────────────────
const GEMINI_API_KEYS = [
  atob('QUl6YVN5Qy1jRVNkUFU5dEpaNi16SUljd0VKTVBzVzMtQXQ1M1I0'),
  atob('QUl6YVN5RFZLcUEzSU91eFcyeXF1encxUjg2ZlVoZTlHbDdpQ3lN')
  // atob('QUl6YVN5QXVLQjRTZ3dYUGx5R213eUx4RmVVTXpkTm9sSm1RdVdr'),
  // atob('QUl6YVN5Qmc5ekdUZUFNOHh0bTNsTWNOZnlWN3Ayd0hCT3FxSWc4')
];

let currentKeyIndex = 0;
let keyCooldowns = {};

function getCurrentAPIKey() {
  return GEMINI_API_KEYS[currentKeyIndex];
}

function getAPIUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getCurrentAPIKey()}`;
}

function updateKeyIndicator() {
  const el = document.getElementById('apiKeyIndicator');
  if (!el) return;
  const total = GEMINI_API_KEYS.length;
  const dots = Array.from({ length: total }, (_, i) => {
    const cooldown = keyCooldowns[i] && Date.now() < keyCooldowns[i];
    const active = i === currentKeyIndex;
    const color = cooldown ? 'var(--fault)' : active ? 'var(--safe)' : 'var(--border2)';
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin:0 2px;transition:all 0.3s" title="Key ${i + 1}${active ? ' (active)' : ''}${cooldown ? ' (rate limited)' : ''}"></span>`;
  }).join('');
  el.innerHTML = `KEY ${currentKeyIndex + 1}/${total} ${dots}`;
}

function switchToNextKey() {
  for (let i = 1; i < GEMINI_API_KEYS.length; i++) {
    const nextIndex = (currentKeyIndex + i) % GEMINI_API_KEYS.length;
    if (!keyCooldowns[nextIndex] || Date.now() > keyCooldowns[nextIndex]) {
      currentKeyIndex = nextIndex;
      updateKeyIndicator();
      return true;
    }
  }
  return false;
}

let pdfText = '';
let pdfPages = [];
let pdfLoaded = false;
let isAiThinking = false;
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 2000;
let usePdfContext = false;

function togglePdfContext() {
  usePdfContext = !usePdfContext;
  const btn = document.getElementById('pdfToggleBtn');
  if (btn) {
    btn.textContent = `📖 PDF: ${usePdfContext ? 'ON' : 'OFF'}`;
    btn.style.background = usePdfContext ? 'var(--safe)' : 'var(--warn)';
  }
  if (usePdfContext && !pdfLoaded) {
    loadPDF();
  }
}
if (usePdfContext && !pdfLoaded) {
  loadPDF();
}


pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── LOAD PDF (embedded base64, no CORS) ──────────────────────────────────
async function loadPDF() {
  if (pdfLoaded) return;
  setAiStatus('LOADING', true);
  try {
    const binary = atob(PDF_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const totalPages = pdfDoc.numPages;
    pdfPages = [];
    let fullText = '';
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      pdfPages.push({ page: i, text: pageText });
      fullText += `\n--- PAGE ${i} ---\n` + pageText;
    }
    pdfText = fullText.trim();
    pdfLoaded = true;
    setAiStatus('READY', false);
  } catch (err) {
    console.error('PDF Load Error:', err);
    setAiStatus('ERROR', false);
  }
}

// ── SMART RETRIEVAL (keyword-scored page ranking) ─────────────────────────
// Instead of dumping 20k chars, find the 3 most relevant pages (~3k chars)
function getRelevantContext(question) {
  const stopWords = new Set([
    'what', 'is', 'are', 'the', 'a', 'an', 'how', 'to', 'do', 'does', 'in', 'of',
    'for', 'and', 'or', 'with', 'can', 'why', 'which', 'when', 'where', 'my', 'its', 'any', 'all'
  ]);
  const keywords = question.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(w => w.length > 2 && !stopWords.has(w));

  // No keywords or no pages — send first 4000 chars as fallback
  if (!keywords.length || !pdfPages.length) {
    return pdfText.substring(0, 4000) + (pdfText.length > 4000 ? '\n...[truncated]' : '');
  }

  // Score each page by keyword frequency
  const scored = pdfPages.map(p => {
    const t = p.text.toLowerCase();
    const score = keywords.reduce((s, kw) => {
      return s + (t.match(new RegExp(kw, 'g')) || []).length;
    }, 0);
    return { ...p, score };
  });

  const top = scored.sort((a, b) => b.score - a.score).slice(0, 3);

  // No hits at all — fall back to first 4000 chars
  if (top[0].score === 0) {
    return pdfText.substring(0, 4000) + '\n...[showing intro section]';
  }

  // Return top pages in document order
  return top
    .sort((a, b) => a.page - b.page)
    .map(p => `--- PAGE ${p.page} ---\n${p.text}`)
    .join('\n\n');
}

function setAiStatus(text, pulse) {
  document.getElementById('aiStatusText').textContent = text;
  const dot = document.querySelector('.ai-dot');
  if (text === 'READY') { dot.style.background = 'var(--safe)'; dot.style.boxShadow = '0 0 8px var(--safe)'; }
  else if (text === 'THINKING') { dot.style.background = 'var(--warn)'; dot.style.boxShadow = '0 0 8px var(--warn)'; }
  else if (text === 'ERROR') { dot.style.background = 'var(--fault)'; dot.style.boxShadow = '0 0 8px var(--fault)'; }
  else if (text === 'LOADING') { dot.style.background = 'var(--warn)'; dot.style.boxShadow = '0 0 8px var(--warn)'; }
  else { dot.style.background = 'var(--accent)'; dot.style.boxShadow = '0 0 8px var(--accent)'; }
}

function showWelcomeLoaded() {
  const chatArea = document.getElementById('aiChatArea');
  const welcome = chatArea.querySelector('.ai-welcome');
  if (welcome) {
    welcome.querySelector('.ai-welcome-title').textContent = 'READY TO HELP';
    welcome.querySelector('.ai-welcome-sub').innerHTML = 'Ask about AC machine faults, warnings, and troubleshooting.<br><br><small style="color:var(--accent);">Developed by <a href="mailto:gkk468971@tatamotors.com" style="color:inherit;font-weight:bold;text-decoration:none;">GOVIND KUMAR</a> | TATA MOTORS</small>';
    welcome.querySelector('.ai-suggestions').style.display = 'flex';
  }
}

function useSuggestion(btn) {
  document.getElementById('aiQuestion').value = btn.textContent;
  askAI();
}

function addChatMessage(role, text) {
  const chatArea = document.getElementById('aiChatArea');
  const welcome = chatArea.querySelector('.ai-welcome');
  if (welcome) welcome.remove();
  const msg = document.createElement('div');
  msg.className = `ai-msg ai-msg-${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'ai-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';
  const bubble = document.createElement('div');
  bubble.className = 'ai-bubble';
  if (role === 'ai' && text === '__thinking__') {
    bubble.innerHTML = '<div class="ai-thinking"><span></span><span></span><span></span></div>';
    msg.id = 'aiThinkingMsg';
  } else {
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^[•\-] (.+)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)+/gs, '<ul>$&</ul>')
      .replace(/\n/g, '<br>');
    bubble.innerHTML = formatted;
  }
  if (role === 'user') { msg.appendChild(bubble); msg.appendChild(avatar); }
  else { msg.appendChild(avatar); msg.appendChild(bubble); }
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
  return msg;
}

// ── AI RESPONSE CACHE (localStorage) ─────────────────────────────────────
const AI_CACHE_KEY = 'ac_ai_cache_v1';
function getCachedAnswer(q) {
  try { const c = JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}'); return c[q.trim().toLowerCase()] || null; }
  catch { return null; }
}
function setCachedAnswer(q, ans) {
  try {
    const c = JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}');
    const key = q.trim().toLowerCase();
    c[key] = ans;
    const keys = Object.keys(c);
    if (keys.length > 50) delete c[keys[0]];
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(c));
  } catch { /* storage full */ }
}

// ── ASK AI ────────────────────────────────────────────────────────────────
async function askAI() {
  const input = document.getElementById('aiQuestion');
  const sendBtn = document.getElementById('aiSendBtn');
  const question = input.value.trim();
  if (!question || isAiThinking) return;

  if (usePdfContext && !pdfLoaded) {
    showToast('📖 Loading PDF... please wait', 'var(--warn)');
    loadPDF().then(() => {
      if (pdfLoaded) askAI();
    });
    return;
  }

  const now = Date.now();
  if (now - lastRequestTime < REQUEST_COOLDOWN) {
    const wait = Math.ceil((REQUEST_COOLDOWN - (now - lastRequestTime)) / 1000);
    showToast(`⏳ Wait ${wait}s`, 'var(--warn)');
    return;
  }
  lastRequestTime = now;

  const cached = getCachedAnswer(question);
  if (cached) {
    input.value = '';
    addChatMessage('user', question);
    setTimeout(() => { addChatMessage('ai', cached); setAiStatus('READY', false); }, 200);
    return;
  }

  isAiThinking = true;
  input.value = '';
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span style="font-size:12px">...</span>';
  setAiStatus('THINKING', true);
  addChatMessage('user', question);
  const thinkingMsg = addChatMessage('ai', '__thinking__');

  let relevantContext = usePdfContext ? getRelevantContext(question) : '';
  const systemPrompt = usePdfContext && pdfLoaded ? `You are a helpful assistant. You were developed by GOVIND KUMAR for Tata Motors. Based on the AC Machine troubleshooting manual, answer the question.\nDOCUMENT CONTEXT: ${relevantContext}\nQUESTION: ${question}` : `You are a helpful AI assistant for AC Machine maintenance. You were developed by GOVIND KUMAR for Tata Motors. Answer the question based on your general knowledge.\nQUESTION: ${question}`;

  // Fetch with auto-retry on 429 + key rotation
  const MAX_RETRIES = 6;
  const MAX_KEY_RETRIES = GEMINI_API_KEYS.length;
  let attempt = 0;
  let keyAttempt = 0;
  let answer = null;

  while (attempt < MAX_RETRIES && keyAttempt < MAX_KEY_RETRIES) {
    attempt++;
    try {
      const bbl = thinkingMsg.querySelector('.ai-bubble');
      if (bbl) bbl.innerHTML = `<div style="color:var(--accent);font-size:10px">Key ${currentKeyIndex + 1}/${GEMINI_API_KEYS.length}...</div>`;

      const response = await fetch(getAPIUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        })
      });

      if (response.status === 429) {
        keyCooldowns[currentKeyIndex] = Date.now() + 60000;
        if (switchToNextKey()) {
          keyAttempt++;
          if (bbl) bbl.innerHTML = `<div style="color:var(--accent);font-size:10px">Rotating to Key ${currentKeyIndex + 1}...</div>`;
          await new Promise(r => setTimeout(r, 1000));
          continue;
        } else {
          const waitSec = Math.pow(2, attempt);
          if (bbl) bbl.innerHTML = `<div style="color:var(--warn);font-size:10px">⏳ Busy — retrying in ${waitSec}s...</div>`;
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
      }
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer received.';
      break;
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        console.error('Gemini Error:', err);
        thinkingMsg.remove();
        addChatMessage('ai', '⚠️ All API keys rate limited. Try again later.');
        setAiStatus('ERROR', false);
        isAiThinking = false;

        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span id="aiSendIcon">➤</span>';
        lastRequestTime = 0;
        document.getElementById('aiQuestion').focus();
        return;
      }
    }
  }

  thinkingMsg.remove();
  if (answer) {
    addChatMessage('ai', answer);
    setCachedAnswer(question, answer);
    setAiStatus('READY', false);
  } else {
    addChatMessage('ai', '⚠️ No response. Try again.');
    setAiStatus('ERROR', false);
  }
  isAiThinking = false;

  sendBtn.disabled = false;
  sendBtn.innerHTML = '<span id="aiSendIcon">➤</span>';
  document.getElementById('aiQuestion').focus();
}
