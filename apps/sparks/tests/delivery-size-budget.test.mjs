import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DELIVERY_SIZE_BUDGETS,
  assertDeliverySizeBudgets,
  collectStaticDeliveryFiles,
  collectStaticImportKeys,
  measureDeliverySizeBudgets
} from '../scripts/lib/deliverySizeBudgets.mjs';

test('delivery budgets cover both initial entries and the largest lazy features', () => {
  assert.deepEqual(
    DELIVERY_SIZE_BUDGETS.map(({ name, mode }) => ({ name, mode })),
    [
      { name: 'student', mode: 'static-graph' },
      { name: 'teacher', mode: 'static-graph' },
      { name: 'reportGenerator', mode: 'chunk' },
      { name: 'quizMaker', mode: 'chunk' },
      { name: 'teacher-charts', mode: 'chunk' }
    ]
  );
  assert.ok(DELIVERY_SIZE_BUDGETS.every(budget => budget.maximumGzipBytes > 0));
});

test('initial delivery measurement includes static JS and CSS once and excludes lazy imports', async () => {
  const manifest = {
    entry: { name: 'student', file: 'entry.js', css: ['entry.css'], imports: ['shared', 'branch'], dynamicImports: ['lazy'] },
    shared: { file: 'shared.js', css: ['shared.css'], imports: ['entry'] },
    branch: { file: 'branch.js', css: ['shared.css'], imports: ['shared'] },
    lazy: { file: 'lazy.js' }
  };
  assert.deepEqual([...collectStaticImportKeys(manifest, 'entry')], ['entry', 'shared', 'branch']);
  assert.deepEqual(
    [...collectStaticDeliveryFiles(manifest, 'entry')],
    ['entry.js', 'entry.css', 'shared.js', 'shared.css', 'branch.js']
  );

  const sizes = new Map([
    ['entry.js', 10], ['entry.css', 5], ['shared.js', 20], ['shared.css', 7],
    ['branch.js', 30], ['lazy.js', 1000]
  ]);
  const [result] = await measureDeliverySizeBudgets(
    manifest,
    async file => sizes.get(file),
    [{ name: 'student', label: 'Student', mode: 'static-graph', maximumGzipBytes: 100 }]
  );
  assert.equal(result.actualGzipBytes, 72);
});

test('chunk budgets measure only the named emitted chunk', async () => {
  const manifest = {
    feature: { name: 'quizMaker', file: 'quiz.js', imports: ['shared'] },
    shared: { file: 'shared.js' }
  };
  const [result] = await measureDeliverySizeBudgets(
    manifest,
    async file => ({ 'quiz.js': 40, 'shared.js': 20 })[file],
    [{ name: 'quizMaker', label: 'Quiz', mode: 'chunk', maximumGzipBytes: 50 }]
  );
  assert.equal(result.actualGzipBytes, 40);
});

test('delivery measurement fails clearly for missing, duplicate, or broken manifest entries', async () => {
  const gzipFile = async () => 1;
  const budget = [{ name: 'student', label: 'Student', mode: 'static-graph', maximumGzipBytes: 100 }];
  await assert.rejects(() => measureDeliverySizeBudgets({}, gzipFile, budget), /found 0/);
  await assert.rejects(() => measureDeliverySizeBudgets({
    first: { name: 'student', file: 'first.js' },
    second: { name: 'student', file: 'second.js' }
  }, gzipFile, budget), /found 2/);
  await assert.rejects(() => measureDeliverySizeBudgets({
    entry: { name: 'student', file: 'entry.js', imports: ['missing'] }
  }, gzipFile, budget), /missing or has no emitted file/);
});

test('delivery budget enforcement accepts the limit and rejects the first exceeded bundle', () => {
  assert.doesNotThrow(() => assertDeliverySizeBudgets([
    { label: 'Student', actualGzipBytes: 1024, maximumGzipBytes: 1024 }
  ]));
  assert.throws(() => assertDeliverySizeBudgets([
    { label: 'Student', actualGzipBytes: 1025, maximumGzipBytes: 1024 }
  ]), /Student exceeds its 1 KiB gzip budget/);
});
