import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GATED_TESTS, discoverTestFiles, selectPortableTests, reachableScripts } from '../scripts/lib/testInventory.mjs';

const files = await discoverTestFiles(fileURLToPath(new URL('./', import.meta.url)));
const scripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).scripts;

test('portable discovery includes every ordinary test once, including newly added nested tests', () => {
    const selected = selectPortableTests([...files, 'nested/new-regression.test.mjs', files[0]]);
    assert.ok(selected.includes('nested/new-regression.test.mjs'));
    assert.equal(new Set(selected).size, selected.length);
    assert.deepEqual(selected.filter(name => Object.hasOwn(GATED_TESTS, name)), []);
    assert.equal(selected.length, files.length - Object.keys(GATED_TESTS).length + 1);
});

test('gated tests cannot silently disappear or run as portable tests without classification', () => {
    assert.throws(() => selectPortableTests(files.filter(name => name !== Object.keys(GATED_TESTS)[0])), /gated test is missing/);
    assert.throws(() => selectPortableTests([...files, 'new-database.test.mjs']), /Classify/);
    assert.throws(() => selectPortableTests([...files, 'nested/new-acceptance.test.mjs']), /Classify/);
});

test('every gated suite is reachable from the release command and executes its registered files', async () => {
    const release = reachableScripts(scripts, 'test:release');
    for (const [file, gate] of Object.entries(GATED_TESTS)) {
        assert.ok(release.has(gate), `${file} must have a release gate: ${gate}`);
        const commands = [...reachableScripts(scripts, gate)].map(name => scripts[name]).join('\n');
        if (commands.includes(file)) continue;
        const harnesses = [...commands.matchAll(/node (scripts\/[\w/.-]+\.mjs)/g)];
        const sources = await Promise.all(harnesses.map(([, path]) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
        assert.ok(sources.some(source => source.includes(file)), `${gate} must execute ${file}`);
    }
    assert.ok(release.has('test:ui:arcade-gameplay'));
    assert.ok(release.has('test:ui:worker-lifecycle'));
});

test('default validation keeps established script checks, insight, and worker upgrades', () => {
    const checks = scripts['test:checks'].split(' && ');
    const expected = [
        'ui-school-admin-smoke', 'ui-school-shell-smoke', 'ui-school-account-access-smoke',
        'ui-student-school-context-smoke', 'ui-student-classroom-entry-smoke', 'ui-student-units-flow-smoke', 'ui-student-spark-library-smoke',
        'ui-teacher-class-workspace-smoke', 'ui-teacher-assignments-smoke',
        'ui-weekly-vocabulary-smoke', 'ui-teacher-data-management-smoke', 'ui-teacher-student-progress-smoke',
        'ui-teacher-groups-smoke', 'ui-teacher-quiz-smoke', 'ui-teacher-sparks-smoke',
        'ui-teacher-word-hunt-smoke', 'ui-teacher-pages-smoke', 'ui-activity-registry-smoke',
        'package-refactor-tests', 'galactic-breaker-tests', 'student-shell-regression-tests',
        'ui-smoke', 'ui-game-sandbox-smoke', 'ui-teacher-student-insight-smoke', 'ui-student-worker-lifecycle-smoke', 'ui-auth-layout-smoke'
    ].map(name => `node scripts/${name}.mjs`);
    assert.deepEqual([...checks].sort(), expected.sort());
    const defaults = reachableScripts(scripts, 'test');
    assert.ok(defaults.has('test:unit'));
    assert.ok(defaults.has('catalog:validate'));
    assert.ok(defaults.has('test:checks'));
});
