import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const [packageJson, readme, workflow] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/static-verification.yml', import.meta.url), 'utf8'),
]);

const pkg = JSON.parse(packageJson);

assert.equal(pkg.private, true, 'package should stay private while published as a static app source repo');
assert.equal(pkg.type, 'module', 'verification scripts rely on native ES modules');
assert.ok(!pkg.dependencies, 'client-pulse should remain zero-install for runtime dependencies');
assert.ok(!pkg.devDependencies, 'client-pulse should keep verification on Node built-ins only');

assert.equal(
  pkg.scripts?.test,
  'node scripts/verify-static.mjs && node scripts/verify-dev-workflow.mjs',
  'npm test should run both product and developer-workflow checks',
);

const requiredReadmeSnippets = [
  'python -m http.server 8000',
  'Then open <http://localhost:8000>.',
  'npm test',
  'Node.js 22+',
  'zero-install static project',
];
const missingReadmeSnippets = requiredReadmeSnippets.filter((snippet) => !readme.includes(snippet));
assert.deepEqual(missingReadmeSnippets, [], `README developer workflow missing: ${missingReadmeSnippets.join(', ')}`);

const requiredWorkflowSnippets = [
  'uses: actions/checkout@v4',
  'uses: actions/setup-node@v4',
  'node-version: 22',
  'run: npm test',
];
const missingWorkflowSnippets = requiredWorkflowSnippets.filter((snippet) => !workflow.includes(snippet));
assert.deepEqual(missingWorkflowSnippets, [], `CI workflow missing: ${missingWorkflowSnippets.join(', ')}`);

console.log('Developer workflow verified: zero-install package, README commands, and CI test entrypoint stay aligned.');
