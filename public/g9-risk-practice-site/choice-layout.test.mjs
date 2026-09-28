import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('choice renderer supplies the marker expected by the two-column choice layout', async () => {
  const source = await readFile(new URL('./shared/foundation-module.js', import.meta.url), 'utf8');
  assert.match(source, /<b aria-hidden="true">\$\{index\+1\}<\/b>\$\{escapeHtml\(option\)\}/);
});
