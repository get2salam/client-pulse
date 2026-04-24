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
const refs = {
  boardTitle: document.querySelector('[data-role="board-title"]'),
  boardSubtitle: document.querySelector('[data-role="board-subtitle"]'),
  stats: document.querySelector('[data-role="stats"]'),
  insights: document.querySelector('[data-role="insights"]'),
  count: document.querySelector('[data-role="count"]'),
  list: document.querySelector('[data-role="list"]'),
  editor: document.querySelector('[data-role="editor"]'),
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

function showToast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  toastHost.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 200);
  }, 2200);
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
    .replaceAll('"', '&quot;');
}

function normalize(item = {}) {
  return {
    id: item.id || uid(),
    title: item.title || 'New client',
    category: CONFIG.categories.includes(item.category) ? item.category : CONFIG.categories[0],
    state: CONFIG.states.includes(item.state) ? item.state : CONFIG.states[0],
    score: Number(item.score ?? 7),
    effort: Number(item.effort ?? 3),
    momentum: Number(item.momentum ?? 5),
    value: Number(item.value ?? 1200),
    contact: item.contact || 'Primary contact',
    lastTouch: item.lastTouch || todayISO(-3),
    nextTouch: item.nextTouch || todayISO(3),
    note: item.note || 'Capture the current relationship context and the next best move.',
  };
}

function priority(item) {
  const urgencyBoost = Math.max(0, 5 - Math.max(daysFromToday(item.nextTouch), 0)) * 4;
  const statusBoost = item.state === 'Urgent' ? 10 : item.state === 'Healthy' ? 5 : item.state === 'Warm' ? 2 : 0;
  return item.score * 7 + item.momentum * 4 + Math.round(item.value / 250) + urgencyBoost + statusBoost - item.effort * 4;
}

function seedState() {
  return {
    boardTitle: CONFIG.boardTitle,
    boardSubtitle: CONFIG.boardSubtitle,
    items: CONFIG.items.map((item) => normalize(item)),
    ui: { search: '', category: 'all', status: 'all', selectedId: null },
  };
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    return {
      ...seedState(),
      ...parsed,
      items: (parsed.items || []).map((item) => normalize(item)),
      ui: { ...seedState().ui, ...(parsed.ui || {}) },
    };
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
    .sort((a, b) => priority(b) - priority(a) || daysFromToday(a.nextTouch) - daysFromToday(b.nextTouch));
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
  const nextItems = state.items.filter((item) => item.id !== target.id);
  commit({
    ...state,
    items: nextItems,
    ui: { ...state.ui, selectedId: nextItems[0]?.id || null },
  });
  showToast('Removed client.');
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
  const raw = await file.text();
  const parsed = JSON.parse(raw);
  commit({
    ...seedState(),
    ...parsed,
    items: (parsed.items || []).map((item) => normalize(item)),
    ui: { ...seedState().ui, ...(parsed.ui || {}) },
  });
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
  const overdue = state.items.filter((item) => daysFromToday(item.nextTouch) <= 0).length;
  const value = state.items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const weeklyTouches = state.items.filter((item) => daysFromToday(item.lastTouch) >= -7).length;
  const healthy = state.items.filter((item) => item.state === 'Healthy').length;
  const cards = [
    ['Clients', String(state.items.length), 'active records in the board'],
    ['Pipeline value', formatMoney(value), 'tracked relationship value'],
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
  const nextTouch = [...state.items].sort((a, b) => daysFromToday(a.nextTouch) - daysFromToday(b.nextTouch))[0];
  const biggest = [...state.items].sort((a, b) => b.value - a.value)[0];
  const atRisk = state.items.find((item) => item.state === 'Urgent') || [...state.items].sort((a, b) => a.momentum - b.momentum)[0];
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
      <p class="eyebrow">${card.label}</p>
      <h3>${card.title}</h3>
      <p>${card.body}</p>
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

  refs.list.innerHTML = items.map((item) => `
    <button class="item ${item.id === state.ui.selectedId ? 'is-selected' : ''}" type="button" data-id="${item.id}">
      <div class="item-top">
        <strong>${item.title}</strong>
        <span class="score">${priority(item)}</span>
      </div>
      <p>${item.note}</p>
      <div class="badge-row">
        <span class="pill ${toneForDue(item)}">Next ${formatDate(item.nextTouch)}</span>
        <span class="pill">${item.contact}</span>
        <span class="pill">${formatMoney(item.value)}</span>
      </div>
      <div class="meta">
        <span>${item.category}</span>
        <span>${item.state}</span>
        <span>Momentum ${item.momentum}/10</span>
        <span>Last touch ${formatDate(item.lastTouch)}</span>
      </div>
    </button>
  `).join('');
}

function renderEditor(item) {
  if (!item) {
    refs.editor.innerHTML = `
      <div class="empty">
        <strong>No selection</strong>
        <p>Pick a client or create a new one.</p>
      </div>
    `;
    return;
  }

  refs.editor.innerHTML = `
    <div class="editor-head">
      <div>
        <p class="eyebrow">Client editor</p>
        <h3>${item.title}</h3>
      </div>
      <span class="score">Priority ${priority(item)}</span>
    </div>
    <div class="editor-grid">
      <label class="field">
        <span>Client name</span>
        <input type="text" data-item-field="title" value="${escapeHtml(item.title)}" />
      </label>
      <label class="field">
        <span>Primary contact</span>
        <input type="text" data-item-field="contact" value="${escapeHtml(item.contact)}" />
      </label>
      <label class="field">
        <span>Context</span>
        <textarea data-item-field="note">${escapeHtml(item.note)}</textarea>
      </label>
      <div class="field-grid">
        <label class="field">
          <span>Type</span>
          <select data-item-field="category">${CONFIG.categories.map((entry) => `<option value="${entry}" ${item.category === entry ? 'selected' : ''}>${entry}</option>`).join('')}</select>
        </label>
        <label class="field">
          <span>Status</span>
          <select data-item-field="state">${CONFIG.states.map((entry) => `<option value="${entry}" ${item.state === entry ? 'selected' : ''}>${entry}</option>`).join('')}</select>
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
  const queue = [...state.items].sort((a, b) => daysFromToday(a.nextTouch) - daysFromToday(b.nextTouch));
  refs.secondaryPrimary.innerHTML = `
    <div class="secondary-head">
      <div>
        <p class="eyebrow">Follow-up queue</p>
        <h3>Who needs attention next</h3>
      </div>
      <span class="chip">${queue.length} tracked</span>
    </div>
    <div class="stack">
      ${queue.slice(0, 5).map((item) => `
        <div class="mini-card">
          <div class="inline-split">
            <strong>${item.title}</strong>
            <span class="pill ${toneForDue(item)}">${formatDate(item.nextTouch)}</span>
          </div>
          <p>${item.contact}, ${item.state} state, ${formatMoney(item.value)} account value.</p>
        </div>
      `).join('')}
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
      ${grouped.map(({ entry, count }) => `<li><span>${entry}</span><strong>${count}</strong></li>`).join('')}
      <li><span>Highest value account</span><strong>${state.items.length ? [...state.items].sort((a, b) => b.value - a.value)[0].title : '—'}</strong></li>
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
  renderEditor(selectedItem());
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
