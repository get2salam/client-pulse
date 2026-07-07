import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const [html, js, state, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/state.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../styles/app.css', import.meta.url), 'utf8'),
]);

function includesAll(source, values, label) {
  const missing = values.filter((value) => !source.includes(value));
  assert.deepEqual(missing, [], `${label} missing: ${missing.join(', ')}`);
}

includesAll(html, [
  '<link rel="stylesheet" href="./styles/app.css" />',
  '<script type="module" src="./js/main.js"></script>',
  'data-role="stats"',
  'data-role="insights"',
  'data-role="list"',
  'data-role="editor"',
  'data-field="search"',
  'data-field="category"',
  'data-field="status"',
  'data-action="import"',
  'data-action="export"',
  'data-action="new"',
], 'HTML app contract');

includesAll(js, [
  "const STORAGE_KEY = `${CONFIG.slug}/state/v2`;",
  "const IMPORT_SCHEMA = `${CONFIG.slug}/v2`;",
  "schema: `${CONFIG.slug}/v2`",
  'function importState(file)',
  'function exportState()',
  "if (event.key.toLowerCase() === 'n')",
  "if (event.key === '/')",
], 'client-pulse persistence and shortcuts');

includesAll(js, [
  'const MAX_IMPORT_BYTES = 128 * 1024;',
  "if (parsed.schema && parsed.schema !== IMPORT_SCHEMA) throw new Error('Import schema is not supported.');",
  "if ('items' in parsed && !Array.isArray(parsed.items)) throw new Error('Import items must be an array.');",
  "if (Array.isArray(parsed.items) && parsed.items.length > MAX_IMPORT_ITEMS) throw new Error('Import contains too many clients.');",
], 'backup import hardening');

includesAll(state, [
  'export const MAX_IMPORT_ITEMS = 100;',
  'function boundedText(value, fallback, limit)',
  'function clampNumber(value, fallback, min, max)',
  'function validISODate(value)',
  'export function normalizeState(snapshot = {})',
  'const seenIds = new Set();',
  "if (seenIds.has(normalized.id)) return { ...normalized, id: uid() };",
], 'state module de-duplicates imported client ids');

includesAll(js, [
  'function escapeHtml(value)',
  'function safeItem(item)',
  ".replaceAll('&', '&amp;')",
  ".replaceAll('<', '&lt;')",
  ".replaceAll('>', '&gt;')",
  ".replaceAll('\"', '&quot;')",
  '.replaceAll("\'", \'&#39;\')',
  'const safe = safeItem(item);',
  '${escapeHtml(card.title)}',
  '${escapeHtml(card.body)}',
  'escapeHtml([...state.items].sort((a, b) => b.value - a.value)[0].title)',
], 'HTML escaping guard');

const renderBlocks = ['refs.insights.innerHTML', 'refs.list.innerHTML', 'refs.editor.innerHTML', 'refs.secondaryPrimary.innerHTML', 'refs.secondarySecondary.innerHTML'];
includesAll(js, renderBlocks, 'expected render surfaces');

includesAll(js, [
  '.map((item) => ({ item, p: priority(item)',
  '.sort((a, b) => b.p - a.p || a.due - b.due)',
  'let overdue = 0, totalValue = 0, weeklyTouches = 0, healthy = 0;',
  'for (const item of state.items)',
  'let nextTouch = null, nextTouchDays = Infinity, atRisk = null, atRiskIsUrgent = false;',
  '.map((item) => ({ item, due: daysFromToday(item.nextTouch) }))',
  'state.items.find((item) => item.id === state.ui.selectedId) || null',
], 'single-pass render optimizations');

includesAll(html, [
  'data-role="status-announcer"',
  'role="status" aria-live="polite"',
  'for="filter-search"',
  'for="filter-category"',
  'for="filter-status"',
  'aria-keyshortcuts="n"',
  'aria-keyshortcuts="/"',
], 'accessibility markup contract');

includesAll(js, [
  'statusAnnouncer: document.querySelector(\'[data-role="status-announcer"]\')',
  "refs.statusAnnouncer.textContent = 'No client selected.';",
  'refs.statusAnnouncer.textContent = `Editing ${item.title}. Priority ${priority(item)}, next touch ${formatDate(item.nextTouch)}.`;',
  'aria-current="true"',
], 'assistive-tech selection announcements');

includesAll(css, [
  '.visually-hidden {',
], 'visually-hidden utility for screen-reader-only status text');

console.log('Static contract verified: app shell, hardened local backup flow, shortcuts, escaped render surfaces, single-pass render optimizations, and screen-reader selection announcements.');
