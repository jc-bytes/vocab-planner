import assert from 'node:assert/strict';
import test from 'node:test';
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';

const owner = 'owner-a';
const payload = () => ({ eventId: 'original-arcade-receipt', gameId: 'snake', clientId: 'original-client' });
const paid = () => ({ receiptFound: true, purchase: { minuteSeconds: 60, coinCost: 10,
    coinWallet: { userId: owner, coins: 7 }, arcadeTime: { userId: owner, availableSeconds: 120 } } });
function fixture(result) {
    const requests = [];
    const service = { currentUser: { uid: owner }, authIdentityGeneration: 1, async init() {},
        client: { rpc(name, params) { requests.push({ name, params });
            return { abortSignal: signal => Promise.resolve({ data: result, error: null, signal }) }; } } };
    installSupabaseStudentWriteMethods(service, { context: { getGeneration: () => 0 } });
    return { service, requests };
}

for (const response of [{ receiptFound: false }, paid()]) {
    test(`installed receipt-only recovery handles explicit ${response.receiptFound} without invoking start`, async () => {
        const { service, requests } = fixture(response);
        const original = payload();
        assert.deepEqual(await service.recoverStudentArcadeMinute(original, { ownerUserId: owner }), response);
        assert.deepEqual(requests, [{ name: 'recover_student_arcade_minute_owned_v1', params: {
            p_expected_user_id: owner, p_event_id: original.eventId, p_game_id: original.gameId, p_client_id: original.clientId
        } }]);
        assert.deepEqual(original, payload());
    });
}

for (const response of [null, undefined, {}, [], [paid()], { receiptFound: false, purchase: {} },
    { receiptFound: 'false' }, { receiptFound: true }, { receiptFound: true, purchase: {} },
    { ...paid(), purchase: { ...paid().purchase, minuteSeconds: 120 } },
    { ...paid(), purchase: { ...paid().purchase, coinWallet: { userId: 'other-owner', coins: 7 } } }]) {
    test(`empty/malformed lookup ${JSON.stringify(response)} fails closed`, async () => {
        const { service, requests } = fixture(response);
        await assert.rejects(service.recoverStudentArcadeMinute(payload(), { ownerUserId: owner }),
            { code: 'INVALID_ARCADE_RECOVERY_RESPONSE' });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].name, 'recover_student_arcade_minute_owned_v1');
    });
}

test('receipt recovery preserves the full-operation deadline and late owner/init guards', async () => {
    const { service, requests } = fixture({ receiptFound: false });
    let release;
    service.init = () => new Promise(resolve => { release = resolve; });
    await assert.rejects(service.recoverStudentArcadeMinute(payload(), { ownerUserId: owner, timeoutMs: 5 }),
        { code: 'REQUEST_TIMEOUT' });
    service.currentUser = { uid: 'owner-b' }; service.authIdentityGeneration++;
    release();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 0);
});

test('lookup never allocates a new purchase receipt or falls back on a server rejection', async () => {
    const { service, requests } = fixture({ receiptFound: false });
    service.client.rpc = (name, params) => {
        requests.push({ name, params });
        return { abortSignal: () => Promise.resolve({ error: { code: 'P0001', message: 'A unique client event ID is required.' } }) };
    };
    const missing = { gameId: 'snake', clientId: 'original-client' };
    await assert.rejects(service.recoverStudentArcadeMinute(missing, { ownerUserId: owner }), { code: 'P0001' });
    assert.equal(missing.eventId, undefined);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].name, 'recover_student_arcade_minute_owned_v1');
});
