import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
    '../supabase/migrations/20260816060159_remove_legacy_student_progress.sql',
    import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');

test('legacy deletion is guarded and restrictive', () => {
    assert.match(sql, /^--[\s\S]*?\nbegin;/i);
    assert.match(sql, /commit;\s*$/i);
    assert.match(sql, /lock table public\.student_progress in access exclusive mode/i);
    assert.match(sql, /a legacy row has no normalized recovery copy/i);
    assert.match(sql, /drop table public\.student_progress\s*;/i);
    assert.doesNotMatch(sql, /drop table public\.student_progress\s+cascade/i);
});

test('profile and fallback XP triggers write only normalized progress', () => {
    assert.match(sql, /create or replace function public\.ensure_student_progress\(\)[\s\S]*insert into public\.student_progress_summary/i);
    assert.match(sql, /create or replace function private\.award_uncapped_student_activity_xp\(\)[\s\S]*insert into public\.student_progress_summary/i);
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.student_progress(?:\s|;)/i);
});

test('legacy RPCs and dual-write helpers are removed', () => {
    for (const name of [
        'accept_student_gift_coins',
        'claim_student_welcome_bonus',
        'ensure_own_student_progress',
        'gift_student_coins',
        'provision_student_progress_for_account',
        'spend_student_coins',
        'submit_student_activity_progress',
        'sync_student_unit_work'
    ]) {
        assert.match(sql, new RegExp(`drop function public\\.${name}`, 'i'));
    }
    assert.match(sql, /drop function private\.apply_legacy_student_progress_to_v2/i);
    assert.match(sql, /drop function private\.sync_legacy_student_progress_to_v2/i);
    assert.match(sql, /drop function private\.student_progress_v2_reconciliation/i);
});

test('normalized integrity monitoring remains after retirement', () => {
    assert.match(sql, /private\.student_progress_normalized_integrity/i);
    assert.match(sql, /'missingSummaries'/i);
    assert.match(sql, /'orphanSummaries'/i);
    assert.match(sql, /revoke all on function private\.student_progress_normalized_integrity/i);
});

test('service-role maintenance keeps explicit normalized table privileges', () => {
    for (const table of [
        'student_progress_summary',
        'student_unit_progress',
        'student_activity_progress',
        'student_activity_state',
        'student_coin_ledger'
    ]) {
        assert.match(sql, new RegExp(
            `grant select, insert, update, delete on public\\.${table} to service_role`, 'i'
        ));
    }
});
