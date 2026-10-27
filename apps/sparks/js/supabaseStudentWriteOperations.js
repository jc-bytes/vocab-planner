import { mapScoreRow } from './services/supabaseValues.js';

const firstRow = (data) => Array.isArray(data) ? data[0] : data;

const requireRpcResult = (mapper, data, error) => {
    if (error) throw error;
    return mapper(firstRow(data));
};

function createOwnerMismatchError() {
    const error = new Error('The authenticated student does not own this saved browser work.');
    error.code = 'SYNC_OWNER_MISMATCH';
    error.status = 403;
    return error;
}

async function resolveExpectedStudentOwner(service, options = {}) {
    const expectedOwnerUserId = String(options.ownerUserId || '').trim();

    if (options.verifyOwner === true || !expectedOwnerUserId) {
        const { data, error } = await service.client.auth.getUser();
        if (error) throw error;
        const verifiedOwnerUserId = String(data?.user?.id || '').trim();
        if (!verifiedOwnerUserId
            || (expectedOwnerUserId && verifiedOwnerUserId !== expectedOwnerUserId)) {
            throw createOwnerMismatchError();
        }
        return verifiedOwnerUserId;
    }

    return expectedOwnerUserId;
}

// The eager delegate owns the deadline and initialization. Verify ownership again
// after asynchronous prerequisites before dispatching the captured write.
async function runStudentWrite(service, buildRequest, options, verifyOwner = true) {
    options.isCurrent?.();
    const ownerUserId = verifyOwner ? await resolveExpectedStudentOwner(service, options) : null;
    options.isCurrent?.();
    const { name, params } = buildRequest(ownerUserId);
    let query = service.client.rpc(name, params);
    if (typeof query.abortSignal === 'function') query = query.abortSignal(options.signal);
    const { data, error } = await query;
    options.isCurrent?.();
    if (error) throw error;
    return firstRow(data);
}

function assertCoinOperationCurrent(options) {
    options.signal?.throwIfAborted();
    if (options.isCurrent && !options.isCurrent()) throw new DOMException('Coin session changed', 'AbortError');
}

export const studentWriteOperations = Object.freeze({
    submitStudentActivityProgress: async function submitStudentActivityProgress(payload = {}, options = {}) {
        return runStudentWrite(this, expectedOwnerUserId => ({
            name: 'submit_student_activity_progress_owned_v1',
            params: {
                p_expected_user_id: expectedOwnerUserId,
                p_event_id: payload.eventId,
                p_unit_key: payload.unitKey,
                p_unit_context: payload.unitContext || {},
                p_activity_type: payload.activityType,
                p_score: payload.score,
                p_is_complete: Boolean(payload.isComplete),
                p_is_finished: Boolean(payload.isFinished),
                p_details: payload.details || {},
                p_metrics: payload.metrics || {},
                p_state_snapshot: payload.stateSnapshot ?? null,
                p_activity_settings: payload.activitySettings || {},
                p_client_id: payload.clientId || '',
                p_is_required: Boolean(payload.isRequired),
                p_attempt_id: payload.attemptId || ''
            }
        }), options);
    },
    submitStudentSparkResponse: async function submitStudentSparkResponse(payload = {}, options = {}) {
        return runStudentWrite(this, expectedOwnerUserId => ({
            name: 'submit_student_spark_response_owned_v1',
            params: {
                p_expected_user_id: expectedOwnerUserId,
                p_spark_id: payload.sparkId,
                p_answers: payload.answers || {}
            }
        }), options);
    },
    startStudentActivityAttempt: async function startStudentActivityAttempt(payload = {}, options = {}) {
        options.isCurrent?.();
        const ownerUserId = await resolveExpectedStudentOwner(this, options);
        options.isCurrent?.();
        options.signal?.throwIfAborted();
        let query = this.client.rpc('start_student_activity_attempt_owned_v1', {
            p_expected_user_id: ownerUserId,
            p_unit_key: payload.unitKey,
            p_vocabulary_id: payload.vocabularyId,
            p_activity_type: payload.activityType
        });
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error, status } = await query;
        if (error) throw Object.assign(new Error(error.message), error, { status: status || error.status });
        return firstRow(data);
    },
    reportStudentActivityTime: async function reportStudentActivityTime(payload = {}, options = {}) {
        return runStudentWrite(this, () => ({
            name: 'report_student_activity_time_v1',
            params: {
                p_attempt_id: payload.attemptId,
                p_active_seconds: Math.max(0, Math.floor(Number(payload.activeSeconds) || 0))
            }
        }), options, false);
    },
    syncStudentUnitWork: async function syncStudentUnitWork(payload = {}, options = {}) {
        return runStudentWrite(this, expectedOwnerUserId => ({
            name: 'sync_student_unit_work_owned_v1',
            params: {
                p_expected_user_id: expectedOwnerUserId,
                p_event_id: payload.eventId,
                p_unit_key: payload.unitKey,
                p_unit_context: payload.unitContext || {},
                p_work_patch: payload.workPatch || {}
            }
        }), options);
    },
    getOwnArcadeTime: async function getOwnArcadeTime(options = {}) {
        return runStudentWrite(this, () => ({
            name: 'get_own_arcade_time_v1',
            params: {}
        }), options, false);
    },
    startStudentArcadeMinute: async function startStudentArcadeMinute(payload = {}, options = {}) {
        assertCoinOperationCurrent(options);
        let query = this.client.rpc('start_student_arcade_minute_owned_v1', {
            p_expected_user_id: options.ownerUserId || this.currentUser?.uid || this.currentUser?.id || null,
            p_event_id: payload.eventId,
            p_game_id: payload.gameId || '',
            p_client_id: payload.clientId || ''
        });
        if (typeof query.abortSignal === 'function') query = query.abortSignal(options.signal);
        const { data, error } = await query;
        assertCoinOperationCurrent(options);
        if (error) throw error;
        return firstRow(data);
    },
    recoverStudentArcadeMinute: async function recoverStudentArcadeMinute(payload = {}, options = {}) {
        assertCoinOperationCurrent(options);
        const ownerUserId = options.ownerUserId || this.currentUser?.uid || this.currentUser?.id || null;
        let query = this.client.rpc('recover_student_arcade_minute_owned_v1', {
            p_expected_user_id: ownerUserId, p_event_id: payload.eventId,
            p_game_id: payload.gameId || '', p_client_id: payload.clientId || ''
        });
        if (typeof query.abortSignal === 'function') query = query.abortSignal(options.signal);
        const { data, error } = await query;
        assertCoinOperationCurrent(options);
        if (error) throw error;
        const result = data;
        const purchase = result?.purchase;
        if (result && !Array.isArray(result) && result.receiptFound === false && !('purchase' in result)) return result;
        if (result?.receiptFound === true && purchase?.minuteSeconds === 60
            && Number.isInteger(purchase.coinCost) && purchase.coinCost > 0 && purchase.coinCost <= 10000
            && purchase.coinWallet?.userId === ownerUserId && Number.isInteger(purchase.coinWallet.coins) && purchase.coinWallet.coins >= 0
            && purchase.arcadeTime?.userId === ownerUserId && Number.isInteger(purchase.arcadeTime.availableSeconds) && purchase.arcadeTime.availableSeconds >= 0) return result;
        const invalid = new Error('Arcade receipt recovery returned an invalid response.');
        invalid.code = 'INVALID_ARCADE_RECOVERY_RESPONSE';
        throw invalid;
    },
    spendStudentCoins: async function spendStudentCoins(payload = {}, options = {}) {
        assertCoinOperationCurrent(options);
        let query = this.client.rpc('spend_student_coins_v2', {
            p_event_id: payload.eventId,
            p_amount: Number(payload.amount) || 0,
            p_source: payload.source || 'game',
            p_description: payload.description || 'Spent on game',
            p_client_id: payload.clientId || ''
        });
        if (options.signal && typeof query.abortSignal === 'function') query = query.abortSignal(options.signal);
        const { data, error } = await query;
        assertCoinOperationCurrent(options);
        if (error) throw error;
        return firstRow(data);
    },
    acceptStudentGiftCoins: async function acceptStudentGiftCoins(payload = {}, options = {}) {
        assertCoinOperationCurrent(options);
        let query = this.client.rpc('accept_student_gift_coins_v2', {
            p_event_id: payload.eventId,
            p_client_id: payload.clientId || ''
        });
        if (options.signal && typeof query.abortSignal === 'function') query = query.abortSignal(options.signal);
        const { data, error } = await query;
        assertCoinOperationCurrent(options);
        if (error) throw error;
        return firstRow(data);
    },
    claimStudentWelcomeBonus: async function claimStudentWelcomeBonus(payload = {}, options = {}) {
        options.isCurrent?.();
        const { data, error } = await this.client.rpc('claim_student_welcome_bonus_v2', {
            p_event_id: payload.eventId,
            p_client_id: payload.clientId || ''
        });
        if (error) throw error;
        return firstRow(data);
    },
    giftStudentCoins: async function giftStudentCoins(payload = {}, options = {}) {
        options.isCurrent?.();
        const { data, error } = await this.client.rpc('gift_student_coins_v2', {
            p_event_id: payload.eventId,
            p_student_id: payload.studentId,
            p_amount: Number(payload.amount) || 0,
            p_message: payload.message || 'Gift from teacher'
        });
        if (error) throw error;
        return firstRow(data);
    },
    submitStudentGameScore: async function submitStudentGameScore(payload = {}, options = {}) {
        options.isCurrent?.();
        const ownerUserId = await resolveExpectedStudentOwner(this, options);
        options.isCurrent?.();
        let request = this.client.rpc('submit_student_game_score_owned_v1', {
            p_expected_user_id: ownerUserId,
            p_game_id: payload.gameId,
            p_score: Number(payload.score) || 0,
            p_metadata: payload.metadata || {}
        });
        if (options.signal && typeof request.abortSignal === 'function') {
            request = request.abortSignal(options.signal);
        }
        const { data, error } = await request;
        return requireRpcResult(mapScoreRow, data, error);
    }
});
