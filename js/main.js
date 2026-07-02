const CONFIG = {
  slug: 'client-pulse',
  title: 'Client Pulse',
  boardTitle: 'Relationship pulse board',
  boardSubtitle: 'A calm view of follow-ups, risk, and growth opportunities.',
  categories: ['Lead', 'Active', 'Expansion', 'Risk'],
  states: ['Cold', 'Warm', 'Healthy', 'Urgent'],
  items: [
    {
      title: 'Blue Ridge Advisory',
      category: 'Active',
      state: 'Healthy',
      score: 9,
      effort: 3,
      momentum: 8,
      value: 3200,
      contact: 'Elena Brooks',
      lastTouch: '2026-04-23',
      nextTouch: '2026-04-29',
      note: 'Weekly async updates keep trust high. Upsell path opens after the new dashboard ships.',
    },
    {
      title: 'Northline Studio',
      category: 'Risk',
      state: 'Urgent',
      score: 8,
      effort: 2,
      momentum: 3,
      value: 1400,
      contact: 'Marcus Hale',
      lastTouch: '2026-04-15',
      nextTouch: '2026-04-24',
      note: 'No reply in 9 days. Needs a direct voice note and one clear next step.',
    },
    {
      title: 'Summit Legal Ops',
      category: 'Expansion',
      state: 'Warm',
      score: 7,
      effort: 4,
      momentum: 6,
      value: 2600,
      contact: 'Aisha Rahman',
      lastTouch: '2026-04-20',
      nextTouch: '2026-05-01',
      note: 'Interested in a retained advisory package if onboarding flow improves.',
    },
  ],
};

const STORAGE_KEY = `${CONFIG.slug}/state/v2`;
const NUMBER_FIELDS = new Set(['score', 'effort', 'momentum', 'value']);
const IMPORT_SCHEMA = `${CONFIG.slug}/v2`;
const MAX_IMPORT_BYTES = 128 * 1024;
const MAX_IMPORT_ITEMS = 100;
const TEXT_LIMITS = {
  id: 80,
  title: 90,
  contact: 80,
  note: 420,
  boardTitle: 80,
  boardSubtitle: 160,
  search: 80,
};
const refs = {
  boardTitle: document.querySelector('[data-role="board-title"]'),
  boardSubtitle: document.querySelector('[data-role="board-subtitle"]'),
  stats: document.querySelector('[data-role="stats"]'),
  insights: document.querySelector('[data-role="insights"]'),
  count: document.querySelector('[data-role="count"]'),
  list: document.querySelector('[data-role="list"]'),
  editor: document.querySelector('[data-role="editor"]'),
  statusAnnouncer: document.querySelector('[data-role="status-announcer"]'),
  secondaryPrimary: document.querySelector('[data-role="secondary-primary"]'),
  secondarySecondary: document.querySelector('[data-role="secondary-secondary"]'),
  search: document.querySelector('[data-field="search"]'),
  category: document.querySelector('[data-field="category"]'),
  status: document.querySelector('[data-field="status"]'),
  importFile: document.querySelector('#import-file'),
};

const toastHost = (() => {
  const host = document.createElement('div');
  host.className = 'toast-host';
  document.body.appendChild(host);
  return host;
})();

function showToast(message, options = {}) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  node.appendChild(text);

  let dismissed = false;
  let exitTimer = null;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (exitTimer) clearTimeout(exitTimer);
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 200);
  };

  if (options.action && typeof options.action.onClick === 'function') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = options.action.label || 'Undo';
    button.addEventListener('click', () => {
      try { options.action.onClick(); } finally { dismiss(); }
    });
    node.appendChild(button);
  }

  toastHost.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  exitTimer = setTimeout(dismiss, options.duration ?? 2200);
}

function uid() {
  return `${CONFIG.slug}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayISO(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function bumpDate(value, days) {
  const date = new Date(`${value || todayISO()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysFromToday(value) {
  if (!value) return 999;
  const today = new Date(`${todayISO()}T00:00:00`);
  const target = new Date(`${value}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function formatDate(value) {
  if (!value) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeItem(item) {
  return {
    ...item,
    id: escapeHtml(item.id),
    title: escapeHtml(item.title),
    category: escapeHtml(item.category),
    state: escapeHtml(item.state),
    contact: escapeHtml(item.contact),
    note: escapeHtml(item.note),
  };
}

function boundedText(value, fallback, limit) {
  const text = typeof value === 'string' ? value : fallback;
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .slice(0, limit);
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function validISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalize(item = {}) {
  const source = item && typeof item === 'object' ? item : {};
  return {
    id: boundedText(source.id || uid(), uid(), TEXT_LIMITS.id),
    title: boundedText(source.title || 'New client', 'New client', TEXT_LIMITS.title),
    category: CONFIG.categories.includes(source.category) ? source.category : CONFIG.categories[0],
    state: CONFIG.states.includes(source.state) ? source.state : CONFIG.states[0],
    score: clampNumber(source.score ?? 7, 7, 1, 10),
    effort: clampNumber(source.effort ?? 3, 3, 1, 10),
    momentum: clampNumber(source.momentum ?? 5, 5, 1, 10),
    value: Math.round(clampNumber(source.value ?? 1200, 1200, 0, 1000000)),
    contact: boundedText(source.contact || 'Primary contact', 'Primary contact', TEXT_LIMITS.contact),
    lastTouch: validISODate(source.lastTouch) ? source.lastTouch : todayISO(-3),
    nextTouch: validISODate(source.nextTouch) ? source.nextTouch : todayISO(3),
    note: boundedText(source.note || 'Capture the current relationship context and the next best move.', 'Capture the current relationship context and the next best move.', TEXT_LIMITS.note),
  };
}

function normalizeUi(ui = {}, items = []) {
  const source = ui && typeof ui === 'object' ? ui : {};
  const selectedId = items.some((item) => item.id === source.selectedId) ? source.selectedId : items[0]?.id || null;
  return {
    search: boundedText(source.search || '', '', TEXT_LIMITS.search),
    category: source.category === 'all' || CONFIG.categories.includes(source.category) ? source.category : 'all',
    status: source.status === 'all' || CONFIG.states.includes(source.status) ? source.status : 'all',
    selectedId,
  };
}

function normalizeState(snapshot = {}) {
  const source = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
  const rawItems = Array.isArray(source.items) ? source.items.slice(0, MAX_IMPORT_ITEMS) : CONFIG.items;
  const items = rawItems.map((item) => normalize(item));
  return {
    boardTitle: boundedText(source.boardTitle || CONFIG.boardTitle, CONFIG.boardTitle, TEXT_LIMITS.boardTitle),
    boardSubtitle: boundedText(source.boardSubtitle || CONFIG.boardSubtitle, CONFIG.boardSubtitle, TEXT_LIMITS.boardSubtitle),
    items,
    ui: normalizeUi(source.ui, items),
  };
}

function priority(item) {
  const urgencyBoost = Math.max(0, 5 - Math.max(daysFromToday(item.nextTouch), 0)) * 4;
  const statusBoost = item.state === 'Urgent' ? 10 : item.state === 'Healthy' ? 5 : item.state === 'Warm' ? 2 : 0;
  return item.score * 7 + item.momentum * 4 + Math.round(item.value / 250) + urgencyBoost + statusBoost - item.effort * 4;
}

function seedState() {
  return normalizeState({ items: CONFIG.items });
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.warn('Falling back to seed state', error);
    return seedState();
  }
}

let state = hydrate();
if (!state.ui.selectedId && state.items[0]) state.ui.selectedId = state.items[0].id;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function filteredItems() {
  const query = state.ui.search.trim().toLowerCase();
  return [...state.items]
    .filter((item) => state.ui.category === 'all' || item.category === state.ui.category)
    .filter((item) => state.ui.status === 'all' || item.state === state.ui.status)
    .filter((item) => !query || `${item.title} ${item.note} ${item.category} ${item.state} ${item.contact}`.toLowerCase().includes(query))
    .map((item) => ({ item, p: priority(item), due: daysFromToday(item.nextTouch) }))
    .sort((a, b) => b.p - a.p || a.due - b.due)
    .map(({ item }) => item);
}

function selectedItem() {
  return state.items.find((item) => item.id === state.ui.selectedId) || filteredItems()[0] || null;
}

function commit(nextState) {
  state = nextState;
  if (!state.ui.selectedId && state.items[0]) state.ui.selectedId = state.items[0].id;
  persist();
  render();
}

function updateSelected(field, value) {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? { ...item, [field]: NUMBER_FIELDS.has(field) ? Number(value) : value } : item),
  });
}

function addItem() {
  const item = normalize({ title: 'New client', contact: 'Primary contact', value: 1800, momentum: 5 });
  commit({
    ...state,
    items: [item, ...state.items],
    ui: { ...state.ui, selectedId: item.id },
  });
  showToast('Added a new client.');
}

function removeSelected() {
  const target = selectedItem();
  if (!target) return;
  const removedIndex = state.items.findIndex((item) => item.id === target.id);
  const nextItems = state.items.filter((item) => item.id !== target.id);
  commit({
    ...state,
    items: nextItems,
    ui: { ...state.ui, selectedId: nextItems[0]?.id || null },
  });
  showToast(`Removed ${target.title}.`, {
    duration: 6000,
    action: {
      label: 'Undo',
      onClick: () => restoreItem(target, removedIndex),
    },
  });
}

function restoreItem(item, index) {
  if (!item || state.items.some((existing) => existing.id === item.id)) return;
  const nextItems = state.items.slice();
  const safeIndex = Math.max(0, Math.min(index ?? nextItems.length, nextItems.length));
  nextItems.splice(safeIndex, 0, item);
  commit({
    ...state,
    items: nextItems,
    ui: { ...state.ui, selectedId: item.id },
  });
  showToast(`Restored ${item.title}.`);
}

function exportState() {
  const blob = new Blob([JSON.stringify({ schema: `${CONFIG.slug}/v2`, ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${CONFIG.slug}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded backup.');
}

async function importState(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Import file is too large.');
  const raw = await file.text();
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Import must be a JSON object.');
  if (parsed.schema && parsed.schema !== IMPORT_SCHEMA) throw new Error('Import schema is not supported.');
  if ('items' in parsed && !Array.isArray(parsed.items)) throw new Error('Import items must be an array.');
  if (Array.isArray(parsed.items) && parsed.items.length > MAX_IMPORT_ITEMS) throw new Error('Import contains too many clients.');
  commit(normalizeState(parsed));
  showToast('Imported backup.');
}

function markContactedToday() {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? {
      ...item,
      lastTouch: todayISO(),
      nextTouch: bumpDate(todayISO(), 7),
      state: item.state === 'Urgent' ? 'Warm' : 'Healthy',
      momentum: Math.min(10, item.momentum + 1),
    } : item),
  });
  showToast('Logged a fresh client touchpoint.');
}

function snoozeFollowUp(days) {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? { ...item, nextTouch: bumpDate(item.nextTouch, days) } : item),
  });
  showToast(`Moved the next touchpoint by ${days} days.`);
}

function markHealthy() {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? { ...item, state: 'Healthy', momentum: Math.max(item.momentum, 7) } : item),
  });
  showToast('Marked this relationship healthy.');
}

function toneForDue(item) {
  const days = daysFromToday(item.nextTouch);
  if (days <= 0) return 'danger';
  if (days <= 3) return 'warn';
  return 'success';
}

function renderStats(items) {
  let overdue = 0, totalValue = 0, weeklyTouches = 0, healthy = 0;
  for (const item of state.items) {
    if (daysFromToday(item.nextTouch) <= 0) overdue++;
    totalValue += Number(item.value || 0);
    if (daysFromToday(item.lastTouch) >= -7) weeklyTouches++;
    if (item.state === 'Healthy') healthy++;
  }
  const cards = [
    ['Clients', String(state.items.length), 'active records in the board'],
    ['Pipeline value', formatMoney(totalValue), 'tracked relationship value'],
    ['Overdue', String(overdue), 'touchpoints needing attention'],
    ['Touched this week', String(weeklyTouches), `${healthy} relationships feel healthy`],
  ];
  refs.stats.innerHTML = cards.map(([label, valueText, note]) => `
    <article class="card stat">
      <span>${label}</span>
      <strong>${valueText}</strong>
      <small>${note}</small>
    </article>
  `).join('');
  const top = items[0];
  refs.count.textContent = top ? `Top: ${top.title}` : 'No clients';
}

function renderInsights(items) {
  let nextTouch = null, nextTouchDays = Infinity, atRisk = null, atRiskIsUrgent = false;
  for (const item of state.items) {
    const days = daysFromToday(item.nextTouch);
    if (days < nextTouchDays) { nextTouch = item; nextTouchDays = days; }
    if (item.state === 'Urgent' && !atRiskIsUrgent) { atRisk = item; atRiskIsUrgent = true; }
    else if (!atRiskIsUrgent && (!atRisk || item.momentum < atRisk.momentum)) { atRisk = item; }
  }
  const cards = [
    {
      label: 'Highest leverage',
      title: items[0]?.title || 'No client yet',
      body: items[0] ? `Priority ${priority(items[0])}, ${formatMoney(items[0].value)} account value.` : 'Add a client to rank the board.',
    },
    {
      label: 'Next touchpoint',
      title: nextTouch?.title || 'Nothing scheduled',
      body: nextTouch ? `${formatDate(nextTouch.nextTouch)} with ${nextTouch.contact}.` : 'Every relationship can carry a next step.',
    },
    {
      label: 'Watch closely',
      title: atRisk?.title || 'No risk detected',
      body: atRisk ? `${atRisk.momentum}/10 momentum, ${atRisk.state} state.` : 'Healthy accounts stay here once momentum slips.',
    },
  ];
  refs.insights.innerHTML = cards.map((card) => `
    <article class="card insight-card">
      <p class="eyebrow">${escapeHtml(card.label)}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
    </article>
  `).join('');
}

function renderList(items) {
  if (!items.length) {
    refs.list.innerHTML = `
      <div class="empty">
        <strong>No client records yet</strong>
        <p>Add clients, note their state, and keep momentum visible.</p>
      </div>
    `;
    return;
  }

  refs.list.innerHTML = items.map((item) => {
    const safe = safeItem(item);
    const isSelected = item.id === state.ui.selectedId;
    return `
    <button class="item ${isSelected ? 'is-selected' : ''}" type="button" data-id="${safe.id}" ${isSelected ? 'aria-current="true"' : ''}>
      <div class="item-top">
        <strong>${safe.title}</strong>
        <span class="score">${priority(item)}</span>
      </div>
      <p>${safe.note}</p>
      <div class="badge-row">
        <span class="pill ${toneForDue(item)}">Next ${formatDate(item.nextTouch)}</span>
        <span class="pill">${safe.contact}</span>
        <span class="pill">${formatMoney(item.value)}</span>
      </div>
      <div class="meta">
        <span>${safe.category}</span>
        <span>${safe.state}</span>
        <span>Momentum ${item.momentum}/10</span>
        <span>Last touch ${formatDate(item.lastTouch)}</span>
      </div>
    </button>
  `;
  }).join('');
}

function renderEditor(item) {
  if (!item) {
    refs.editor.innerHTML = `
      <div class="empty">
        <strong>No selection</strong>
        <p>Pick a client or create a new one.</p>
      </div>
    `;
    refs.statusAnnouncer.textContent = 'No client selected.';
    return;
  }

  const safe = safeItem(item);
  refs.statusAnnouncer.textContent = `Editing ${item.title}. Priority ${priority(item)}, next touch ${formatDate(item.nextTouch)}.`;

  refs.editor.innerHTML = `
    <div class="editor-head">
      <div>
        <p class="eyebrow">Client editor</p>
        <h3>${safe.title}</h3>
      </div>
      <span class="score">Priority ${priority(item)}</span>
    </div>
    <div class="editor-grid">
      <label class="field">
        <span>Client name</span>
        <input type="text" data-item-field="title" value="${safe.title}" />
      </label>
      <label class="field">
        <span>Primary contact</span>
        <input type="text" data-item-field="contact" value="${safe.contact}" />
      </label>
      <label class="field">
        <span>Context</span>
        <textarea data-item-field="note">${safe.note}</textarea>
      </label>
      <div class="field-grid">
        <label class="field">
          <span>Type</span>
          <select data-item-field="category">${CONFIG.categories.map((entry) => `<option value="${escapeHtml(entry)}" ${item.category === entry ? 'selected' : ''}>${escapeHtml(entry)}</option>`).join('')}</select>
        </label>
        <label class="field">
          <span>Status</span>
          <select data-item-field="state">${CONFIG.states.map((entry) => `<option value="${escapeHtml(entry)}" ${item.state === entry ? 'selected' : ''}>${escapeHtml(entry)}</option>`).join('')}</select>
        </label>
      </div>
      <div class="field-grid">
        <label class="field">
          <span>Last touch</span>
          <input type="date" data-item-field="lastTouch" value="${item.lastTouch}" />
        </label>
        <label class="field">
          <span>Next touch</span>
          <input type="date" data-item-field="nextTouch" value="${item.nextTouch}" />
        </label>
      </div>
      <div class="field-grid three">
        <label class="field range-wrap">
          <span>Momentum</span>
          <input type="range" min="1" max="10" data-item-field="momentum" value="${item.momentum}" />
          <output>${item.momentum} / 10</output>
        </label>
        <label class="field range-wrap">
          <span>Signal</span>
          <input type="range" min="1" max="10" data-item-field="score" value="${item.score}" />
          <output>${item.score} / 10</output>
        </label>
        <label class="field range-wrap">
          <span>Effort</span>
          <input type="range" min="1" max="10" data-item-field="effort" value="${item.effort}" />
          <output>${item.effort} / 10</output>
        </label>
      </div>
      <label class="field">
        <span>Tracked value</span>
        <input type="number" min="0" step="100" data-item-field="value" value="${item.value}" />
      </label>
      <div class="quick-actions">
        <button class="btn" type="button" data-action="contacted-today">Mark contacted today</button>
        <button class="btn" type="button" data-action="snooze-3">Push next touch +3 days</button>
        <button class="btn" type="button" data-action="mark-healthy">Mark healthy</button>
      </div>
      <div class="editor-actions">
        <span class="helper">Last touch ${formatDate(item.lastTouch)}, next touch ${formatDate(item.nextTouch)}.</span>
        <button class="btn btn-danger" type="button" data-action="remove-current">Remove</button>
      </div>
    </div>
  `;
}

function renderQueues() {
  const queue = state.items
    .map((item) => ({ item, due: daysFromToday(item.nextTouch) }))
    .sort((a, b) => a.due - b.due)
    .map(({ item }) => item);
  refs.secondaryPrimary.innerHTML = `
    <div class="secondary-head">
      <div>
        <p class="eyebrow">Follow-up queue</p>
        <h3>Who needs attention next</h3>
      </div>
      <span class="chip">${queue.length} tracked</span>
    </div>
    <div class="stack">
      ${queue.slice(0, 5).map((item) => {
        const safe = safeItem(item);
        return `
        <div class="mini-card">
          <div class="inline-split">
            <strong>${safe.title}</strong>
            <span class="pill ${toneForDue(item)}">${formatDate(item.nextTouch)}</span>
          </div>
          <p>${safe.contact}, ${safe.state} state, ${formatMoney(item.value)} account value.</p>
        </div>
      `;
      }).join('')}
    </div>
  `;

  const grouped = CONFIG.states.map((entry) => ({ entry, count: state.items.filter((item) => item.state === entry).length }));
  refs.secondarySecondary.innerHTML = `
    <div class="secondary-head">
      <div>
        <p class="eyebrow">Snapshot</p>
        <h3>Relationship balance</h3>
      </div>
      <span class="chip">${formatMoney(state.items.reduce((sum, item) => sum + item.value, 0))}</span>
    </div>
    <ul class="metric-list">
      ${grouped.map(({ entry, count }) => `<li><span>${escapeHtml(entry)}</span><strong>${count}</strong></li>`).join('')}
      <li><span>Highest value account</span><strong>${state.items.length ? escapeHtml([...state.items].sort((a, b) => b.value - a.value)[0].title) : '—'}</strong></li>
    </ul>
  `;
}

function render() {
  refs.boardTitle.textContent = state.boardTitle;
  refs.boardSubtitle.textContent = state.boardSubtitle;
  refs.search.value = state.ui.search;
  refs.category.innerHTML = `<option value="all">All types</option>${CONFIG.categories.map((entry) => `<option value="${entry}" ${state.ui.category === entry ? 'selected' : ''}>${entry}</option>`).join('')}`;
  refs.status.innerHTML = `<option value="all">All statuses</option>${CONFIG.states.map((entry) => `<option value="${entry}" ${state.ui.status === entry ? 'selected' : ''}>${entry}</option>`).join('')}`;
  const items = filteredItems();
  if (!items.some((item) => item.id === state.ui.selectedId)) state.ui.selectedId = items[0]?.id || null;
  renderStats(items);
  renderInsights(items);
  renderList(items);
  renderEditor(state.items.find((item) => item.id === state.ui.selectedId) || null);
  renderQueues();
}

document.addEventListener('click', (event) => {
  const itemButton = event.target.closest('.item');
  if (itemButton) {
    commit({ ...state, ui: { ...state.ui, selectedId: itemButton.dataset.id } });
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'new') addItem();
  if (action === 'reset') { commit(seedState()); showToast('Re-seeded sample board.'); }
  if (action === 'remove-current') removeSelected();
  if (action === 'export') exportState();
  if (action === 'import') refs.importFile.click();
  if (action === 'contacted-today') markContactedToday();
  if (action === 'snooze-3') snoozeFollowUp(3);
  if (action === 'mark-healthy') markHealthy();
});

document.addEventListener('input', (event) => {
  const field = event.target.dataset.field;
  if (field === 'search') {
    commit({ ...state, ui: { ...state.ui, search: event.target.value } });
    return;
  }
  const itemField = event.target.dataset.itemField;
  if (itemField) updateSelected(itemField, event.target.value);
});

document.addEventListener('change', async (event) => {
  const field = event.target.dataset.field;
  if (field === 'category' || field === 'status') {
    commit({ ...state, ui: { ...state.ui, [field]: event.target.value } });
    return;
  }
  if (event.target.id === 'import-file') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importState(file);
    } catch (error) {
      console.error(error);
      showToast('Import failed.');
    } finally {
      event.target.value = '';
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, textarea, select')) return;
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    addItem();
  }
  if (event.key === '/') {
    event.preventDefault();
    refs.search.focus();
  }
});

render();
