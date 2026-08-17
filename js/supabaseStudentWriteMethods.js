import { mapScoreRow } from './services/supabaseValues.js';

const firstRow = (data) => Array.isArray(data) ? data[0] : data;

const createEventId = operation => {
    const randomPart = globalThis.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${operation}:${randomPart}`;
};

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

export function installSupabaseStudentWriteMethods(service) {
    service.ensureOwnStudentProgress = async function ensureOwnStudentProgress(studentProfile = {}, options = {}) {
        await this.init();
        let query = this.client.rpc('get_own_student_progress_v2');
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return firstRow(data);
    };

    service.submitStudentActivityProgress = async function submitStudentActivityProgress(payload = {}, options = {}) {
        await this.init();
        const expectedOwnerUserId = await resolveExpectedStudentOwner(this, options);
        payload.eventId ||= createEventId('activity-progress');
        const { data, error } = await this.client.rpc('submit_student_activity_progress_owned_v1', {
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
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.submitStudentSparkResponse = async function submitStudentSparkResponse(payload = {}, options = {}) {
        await this.init();
        const expectedOwnerUserId = await resolveExpectedStudentOwner(this, options);
        const { data, error } = await this.client.rpc('submit_student_spark_response_owned_v1', {
            p_expected_user_id: expectedOwnerUserId,
            p_spark_id: payload.sparkId,
            p_answers: payload.answers || {}
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.startStudentActivityAttempt = async function startStudentActivityAttempt(payload = {}) {
        await this.init();
        let query = this.client.rpc('start_student_activity_attempt', {
            p_unit_key: payload.unitKey,
            p_vocabulary_id: payload.vocabularyId,
            p_activity_type: payload.activityType
        });
        if (payload.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(payload.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return firstRow(data);
    };

    service.syncStudentUnitWork = async function syncStudentUnitWork(payload = {}, options = {}) {
        await this.init();
        const expectedOwnerUserId = await resolveExpectedStudentOwner(this, options);
        payload.eventId ||= createEventId('unit-work');
        const { data, error } = await this.client.rpc('sync_student_unit_work_owned_v1', {
            p_expected_user_id: expectedOwnerUserId,
            p_event_id: payload.eventId,
            p_unit_key: payload.unitKey,
            p_unit_context: payload.unitContext || {},
            p_work_patch: payload.workPatch || {}
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.getOwnArcadeTime = async function getOwnArcadeTime() {
        await this.init();
        const { data, error } = await this.client.rpc('get_own_arcade_time_v1');
        if (error) throw error;
        return firstRow(data);
    };

    service.startStudentArcadeMinute = async function startStudentArcadeMinute(payload = {}) {
        await this.init();
        payload.eventId ||= createEventId('arcade-minute');
        const { data, error } = await this.client.rpc('start_student_arcade_minute_v1', {
            p_event_id: payload.eventId,
            p_game_id: payload.gameId || '',
            p_client_id: payload.clientId || ''
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.spendStudentCoins = async function spendStudentCoins(payload = {}) {
        await this.init();
        payload.eventId ||= createEventId('spend-coins');
        const { data, error } = await this.client.rpc('spend_student_coins_v2', {
            p_event_id: payload.eventId,
            p_amount: Number(payload.amount) || 0,
            p_source: payload.source || 'game',
            p_description: payload.description || 'Spent on game',
            p_client_id: payload.clientId || ''
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.acceptStudentGiftCoins = async function acceptStudentGiftCoins(payload = {}) {
        await this.init();
        payload.eventId ||= createEventId('accept-gift');
        const { data, error } = await this.client.rpc('accept_student_gift_coins_v2', {
            p_event_id: payload.eventId,
            p_client_id: payload.clientId || ''
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.claimStudentWelcomeBonus = async function claimStudentWelcomeBonus(payload = {}) {
        await this.init();
        payload.eventId ||= createEventId('welcome-bonus');
        const { data, error } = await this.client.rpc('claim_student_welcome_bonus_v2', {
            p_event_id: payload.eventId,
            p_client_id: payload.clientId || ''
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.giftStudentCoins = async function giftStudentCoins(payload = {}) {
        await this.init();
        payload.eventId ||= createEventId('teacher-gift');
        const { data, error } = await this.client.rpc('gift_student_coins_v2', {
            p_event_id: payload.eventId,
            p_student_id: payload.studentId,
            p_amount: Number(payload.amount) || 0,
            p_message: payload.message || 'Gift from teacher'
        });
        if (error) throw error;
        return firstRow(data);
    };

    service.submitStudentGameScore = async function submitStudentGameScore(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('submit_student_game_score', {
            p_game_id: payload.gameId,
            p_score: Number(payload.score) || 0,
            p_metadata: payload.metadata || {}
        });
        return requireRpcResult(mapScoreRow, data, error);
    };
}
