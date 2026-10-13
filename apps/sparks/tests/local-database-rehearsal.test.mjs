import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocalDatabaseSource } from '../scripts/lib/localDatabaseRehearsal.mjs';

test('local rehearsal follows repository project configuration and explicit local overrides', () => {
    assert.deepEqual(resolveLocalDatabaseSource('project_id = "another-project"'), { container: 'supabase_db_another-project', database: 'postgres' });
    assert.deepEqual(resolveLocalDatabaseSource('', { SPARKS_LOCAL_DB_CONTAINER: 'supabase_db_fixture', SPARKS_LOCAL_SOURCE_DATABASE: 'student_insight_rehearsal_ab123' }), { container: 'supabase_db_fixture', database: 'student_insight_rehearsal_ab123' });
});
test('local rehearsal refuses remote sources, malformed identifiers and unrelated databases', () => {
    assert.throws(() => resolveLocalDatabaseSource(''), /Missing project_id/);
    assert.throws(() => resolveLocalDatabaseSource('', { SPARKS_LOCAL_DB_CONTAINER: 'hosted-db.example' }), /local Supabase/);
    assert.throws(() => resolveLocalDatabaseSource('project_id = "safe"', { SPARKS_LOCAL_SOURCE_DATABASE: 'another_database' }), /local source/);
    assert.throws(() => resolveLocalDatabaseSource('', { SPARKS_LOCAL_DB_CONTAINER: 'supabase_db_x;bad' }), /local Supabase/);
});
