export const CONFIG = {
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

const TEXT_LIMITS = {
  id: 80,
  title: 90,
  contact: 80,
  note: 420,
  boardTitle: 80,
  boardSubtitle: 160,
  search: 80,
};

export const MAX_IMPORT_ITEMS = 100;

function uid() {
  return `${CONFIG.slug}_${Math.random().toString(36).slice(2, 10)}`;
}

export function todayISO(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
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

export function normalize(item = {}) {
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

export function normalizeState(snapshot = {}) {
  const source = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot : {};
  const rawItems = Array.isArray(source.items) ? source.items.slice(0, MAX_IMPORT_ITEMS) : CONFIG.items;
  // Imported backups can carry duplicate client ids (hand-merged exports, older
  // schema versions). Without de-duplication, every action keyed by id
  // (update/remove/select) would silently apply to every client sharing it.
  const seenIds = new Set();
  const items = rawItems.map((item) => {
    const normalized = normalize(item);
    if (seenIds.has(normalized.id)) return { ...normalized, id: uid() };
    seenIds.add(normalized.id);
    return normalized;
  });
  return {
    boardTitle: boundedText(source.boardTitle || CONFIG.boardTitle, CONFIG.boardTitle, TEXT_LIMITS.boardTitle),
    boardSubtitle: boundedText(source.boardSubtitle || CONFIG.boardSubtitle, CONFIG.boardSubtitle, TEXT_LIMITS.boardSubtitle),
    items,
    ui: normalizeUi(source.ui, items),
  };
}
