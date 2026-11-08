import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('release catalog contains no school content', () => {
    execFileSync(process.execPath, ['scripts/validate-vocabulary-catalog.mjs'], { cwd: workspaceRoot });
});
test('retired importer fails without emitting SQL', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-vocabulary-catalog-upsert.mjs', '--grade', 'all'], { cwd: workspaceRoot, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /File catalog imports have been retired/);
});
test('database writes normalize explicit required and additional activity flow', () => {
    const migration = readFileSync(path.join(
        workspaceRoot,
        'supabase/migrations/20260815230047_enforce_explicit_vocabulary_activity_flow.sql'
    ), 'utf8');

    assert.match(migration, /before insert or update of id, name, week, activity_settings/i);
    assert.match(migration, /required_list := private\.required_vocabulary_activities\(new\)/i);
    assert.match(migration, /'\{requiredActivities\}'/);
    assert.match(migration, /'\{additionalActivities\}'/);
    assert.match(migration, /update public\.vocabularies[\s\S]*jsonb_typeof[\s\S]*is distinct from 'array'/i);
    assert.match(migration, /revoke all on function private\.normalize_vocabulary_activity_flow\(\)/i);
});
