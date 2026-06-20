import { toClientRow } from './supabaseServiceHelpers.js';

const firstRow = (data) => Array.isArray(data) ? data[0] : data;

const requireRpcResult = (tableName, data, error) => {
    if (error) throw error;
    return toClientRow(tableName, firstRow(data));
};

export function installSupabaseStudentWriteMethods(service) {
    service.ensureOwnStudentProgress = async function ensureOwnStudentProgress(studentProfile = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('ensure_own_student_progress', {
            p_student_profile: studentProfile || {}
        });
        return requireRpcResult('student_progress', data, error);
    };

    service.submitStudentActivityProgress = async function submitStudentActivityProgress(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('submit_student_activity_progress', {
            p_unit_key: payload.unitKey,
            p_unit_context: payload.unitContext || {},
            p_activity_type: payload.activityType,
            p_score: payload.score,
            p_is_complete: Boolean(payload.isComplete),
            p_details: payload.details || {},
            p_activity_settings: payload.activitySettings || {},
            p_client_id: payload.clientId || '',
            p_is_required: Boolean(payload.isRequired),
            p_attempt_id: payload.attemptId || ''
        });
        return requireRpcResult('student_progress', data, error);
    };

    service.syncStudentUnitWork = async function syncStudentUnitWork(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('sync_student_unit_work', {
            p_unit_key: payload.unitKey,
            p_unit_context: payload.unitContext || {},
            p_work_patch: payload.workPatch || {}
        });
        return requireRpcResult('student_progress', data, error);
    };

    service.spendStudentCoins = async function spendStudentCoins(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('spend_student_coins', {
            p_amount: Number(payload.amount) || 0,
            p_source: payload.source || 'game',
            p_description: payload.description || 'Spent on game',
            p_client_id: payload.clientId || ''
        });
        return requireRpcResult('student_progress', data, error);
    };

    service.acceptStudentGiftCoins = async function acceptStudentGiftCoins(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('accept_student_gift_coins', {
            p_client_id: payload.clientId || ''
        });
        return requireRpcResult('student_progress', data, error);
    };

    service.claimStudentWelcomeBonus = async function claimStudentWelcomeBonus(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('claim_student_welcome_bonus', {
            p_client_id: payload.clientId || ''
        });
        return requireRpcResult('student_progress', data, error);
    };

    service.giftStudentCoins = async function giftStudentCoins(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('gift_student_coins', {
            p_student_id: payload.studentId,
            p_amount: Number(payload.amount) || 0,
            p_message: payload.message || 'Gift from teacher'
        });
        return requireRpcResult('student_progress', data, error);
    };

    service.submitStudentGameScore = async function submitStudentGameScore(payload = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('submit_student_game_score', {
            p_game_id: payload.gameId,
            p_score: Number(payload.score) || 0,
            p_metadata: payload.metadata || {}
        });
        return requireRpcResult('scores', data, error);
    };
}
