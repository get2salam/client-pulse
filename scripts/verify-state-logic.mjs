import assert from 'node:assert/strict';
import { normalizeState } from '../js/state.mjs';

// Regression: a backup with duplicate client ids (hand-merged exports, or two
// exports imported back to back) used to let one "Remove" or edit action
// silently touch every client sharing that id, since updateSelected/
// removeSelected match by id. normalizeState must give every client a unique
// id on import without dropping any records.
const duplicateIdBackup = {
  items: [
    { id: 'shared-id', title: 'Blue Ridge Advisory', value: 3200 },
    { id: 'shared-id', title: 'Northline Studio', value: 1400 },
    { id: 'shared-id', title: 'Summit Legal Ops', value: 2600 },
  ],
};

const deduped = normalizeState(duplicateIdBackup);

assert.equal(deduped.items.length, 3, 'duplicate-id import must not drop clients');
const ids = deduped.items.map((item) => item.id);
assert.equal(new Set(ids).size, 3, 'normalizeState must de-duplicate imported client ids');
assert.deepEqual(
  deduped.items.map((item) => item.title),
  ['Blue Ridge Advisory', 'Northline Studio', 'Summit Legal Ops'],
  'de-duplication must preserve every client record, not just make the ids unique',
);

// Unique ids from a well-formed backup must survive untouched: UI state
// (selectedId) and the undo/restore flow both depend on id stability.
const stableIdBackup = {
  items: [
    { id: 'kept-id-1', title: 'Alpha Co' },
    { id: 'kept-id-2', title: 'Beta Co' },
  ],
};
const stable = normalizeState(stableIdBackup);
assert.deepEqual(stable.items.map((item) => item.id), ['kept-id-1', 'kept-id-2'], 'unique ids must not be rewritten');

console.log('State logic verified: duplicate client ids from imported backups no longer collide.');
