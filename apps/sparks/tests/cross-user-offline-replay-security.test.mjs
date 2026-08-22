import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL(
    '../supabase/migrations/20260816225620_cross_user_offline_replay_guard.sql',
    import.meta.url
), 'utf8');
const clientWrites = await readFile(new URL('../js/supabaseStudentWriteMethods.js', import.meta.url), 'utf8');
const replayQueue = await readFile(new URL('../js/student/studentProgressSyncQueue.js', import.meta.url), 'utf8');

test('replayed student mutations atomically bind the authenticated user to the browser owner', () => {
    for (const functionName of [
        'sync_student_unit_work_owned_v1',
        'submit_student_activity_progress_owned_v1',
        'submit_student_spark_response_owned_v1'
    ]) {
        const section = migration.split(`create or replace function public.${functionName}`)[1];
        assert.ok(section, `Missing ${functionName}`);
        assert.match(section, /p_expected_user_id uuid/i);
        assert.match(section, /auth\.uid\(\) <> p_expected_user_id/i);
        assert.match(section, /errcode = '42501'/i);
        assert.match(section, /security invoker/i);
    }
});

test('owner-bound replay RPCs remain unavailable to anonymous clients', () => {
    for (const functionName of [
        'sync_student_unit_work_owned_v1',
        'submit_student_activity_progress_owned_v1',
        'submit_student_spark_response_owned_v1'
    ]) {
        assert.match(migration, new RegExp(
            `revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon`,
            'i'
        ));
        assert.match(migration, new RegExp(
            `grant execute on function public\\.${functionName}[\\s\\S]*?to authenticated`,
            'i'
        ));
    }
});

test('the client verifies replay identity and sends the persisted owner to every guarded RPC', () => {
    assert.match(clientWrites, /client\.auth\.getUser\(\)/);
    assert.match(clientWrites, /SYNC_OWNER_MISMATCH/);
    assert.match(clientWrites, /p_expected_user_id: expectedOwnerUserId/g);
    assert.match(replayQueue, /ownerUserId,\s*verifyOwner: true/g);
});
