import test from 'node:test';
import assert from 'node:assert/strict';

import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';

function createService(responses = {}) {
    const calls = [];
    const service = {
        async init() {},
        client: {
            async rpc(name, args) {
                calls.push({ name, args });
                const queue = responses[name] || [];
                return queue.shift() || { data: null, error: null };
            }
        }
    };
    installSupabaseStudentWriteMethods(service);
    return { service, calls };
}

test('existing students load the normalized snapshot without reading the legacy row', async () => {
    const snapshot = { userId: 'student-1', units: {}, totalXp: 18, coinData: { balance: 4 } };
    const { service, calls } = createService({
        get_own_student_progress_v2: [{ data: snapshot, error: null }]
    });

    assert.deepEqual(await service.ensureOwnStudentProgress({ firstName: 'Ada' }), snapshot);
    assert.deepEqual(calls.map(call => call.name), ['get_own_student_progress_v2']);
});

test('activity writes use one stable idempotency key and return a compact v2 delta', async () => {
    const delta = {
        version: 9,
        totalXp: 50,
        activity: { unitKey: 'unit-1', activityType: 'matching', score: 100 }
    };
    const { service, calls } = createService({
        submit_student_activity_progress_v2: [{ data: delta, error: null }]
    });
    const payload = { unitKey: 'unit-1', activityType: 'matching', score: 100 };

    assert.deepEqual(await service.submitStudentActivityProgress(payload), delta);
    assert.match(payload.eventId, /^activity-progress:/);
    assert.equal(calls[0].args.p_event_id, payload.eventId);
    assert.equal(calls.some(call => call.name === 'submit_student_activity_progress'), false);
});

test('unit work and wallet mutations use only normalized idempotent RPCs', async () => {
    const unitDelta = { version: 2, unit: { unitKey: 'unit-1', states: {} } };
    const wallet = { version: 3, coins: 8, coinData: { balance: 8 } };
    const { service, calls } = createService({
        sync_student_unit_work_v2: [{ data: unitDelta, error: null }],
        spend_student_coins_v2: [{ data: wallet, error: null }]
    });
    const unitPayload = { unitKey: 'unit-1', workPatch: { note: 'saved' } };
    const spendPayload = { amount: 2, clientId: 'client-1' };

    assert.deepEqual(await service.syncStudentUnitWork(unitPayload), unitDelta);
    assert.deepEqual(await service.spendStudentCoins(spendPayload), wallet);
    assert.match(unitPayload.eventId, /^unit-work:/);
    assert.match(spendPayload.eventId, /^spend-coins:/);
    assert.deepEqual(calls.map(call => call.name), [
        'sync_student_unit_work_v2',
        'spend_student_coins_v2'
    ]);
});
