import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    loadVocabularyCatalog,
    resolveActivityFlow,
    validateVocabulary
} from '../scripts/lib/vocabularyCatalog.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every vocabulary unit has explicit valid placement and activity flow', async () => {
    const records = await loadVocabularyCatalog(workspaceRoot);
    assert.equal(records.length > 0, true);
    const errors = records.flatMap(record => validateVocabulary(record.vocabulary, record.entry.path));
    assert.deepEqual(errors, []);

    for (const { vocabulary } of records) {
        const flow = resolveActivityFlow(vocabulary);
        assert.deepEqual(flow.required, vocabulary.activitySettings.requiredActivities);
        assert.deepEqual(flow.additional, vocabulary.activitySettings.additionalActivities);
    }
});

test('T3 class parts have small sourced word sets and distinct required practice', async () => {
    const records = await loadVocabularyCatalog(workspaceRoot);
    const t3 = records.map(r => r.vocabulary).filter(v => ['3', 'IIIT'].includes(String(v.trimester)));
    assert.equal(t3.length, 91);
    for (const v of t3) {
        assert.match(v.id, /^grade[6-9]_t3_2026_w\d{2}_part[12]$/);
        assert.ok(v.words.length === 2 || v.words.length === 3);
        const part = v.id.endsWith('part1') ? 1 : 2;
        assert.match(v.name, new RegExp(`Part ${part} - `));
        assert.deepEqual(v.activitySettings.requiredActivities,
            ['flashcards', part === 1 ? 'matching' : 'fill-in-blank']);
        assert.deepEqual(v.activitySettings.additionalActivities, []);
        for (const word of v.words) {
            assert.ok(word.definition && word.example);
            assert.match(word.source, /^https:\/\//);
            assert.ok(word.example.toLowerCase().includes(word.word.toLowerCase()));
        }
    }
});

test('catalog SQL updates existing rows and verifies database parity transactionally', () => {
    const sql = execFileSync(process.execPath, [
        'scripts/generate-vocabulary-catalog-upsert.mjs', '--grade', 'all'
    ], { cwd: workspaceRoot, encoding: 'utf8' });

    assert.match(sql, /on conflict \(id\) do update set/i);
    assert.doesNotMatch(sql, /on conflict \(id\) do nothing/i);
    assert.match(sql, /Vocabulary catalog verification failed after upsert/);
    assert.match(sql, /grade9_iit_june_week3_loops_strings/);
    assert.match(sql, /"requiredActivities":\["flashcards","word-search"\]/);
    assert.match(sql, /^begin;[\s\S]*commit;\s*$/i);
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
