import { createUniqueId } from './randomUtils.js';
import { requestWithTimeout } from './services/requestReliability.js';
import { schoolContext } from './services/schoolContext.js';
import { captureSupabaseOperation } from './services/supabaseOperationSession.js';

const EVENT_PREFIXES = Object.freeze({
    submitStudentActivityProgress: 'activity-progress:',
    syncStudentUnitWork: 'unit-work:',
    startStudentArcadeMinute: 'arcade-minute:',
    spendStudentCoins: 'spend-coins:',
    acceptStudentGiftCoins: 'accept-gift:',
    claimStudentWelcomeBonus: 'welcome-bonus:',
    giftStudentCoins: 'teacher-gift:'
});
const LAZY_METHODS = Object.freeze([
    'submitStudentActivityProgress', 'submitStudentSparkResponse',
    'startStudentActivityAttempt', 'reportStudentActivityTime', 'syncStudentUnitWork',
    'getOwnArcadeTime', 'startStudentArcadeMinute', 'recoverStudentArcadeMinute', 'spendStudentCoins',
    'acceptStudentGiftCoins', 'claimStudentWelcomeBonus', 'giftStudentCoins',
    'submitStudentGameScore'
]);

export function installSupabaseStudentWriteMethods(service, {
    loadOperations = () => import('./supabaseStudentWriteOperations.js'),
    context = schoolContext
} = {}) {
    // Account startup needs progress immediately; feature writes load on demand.
    service.ensureOwnStudentProgress = async function ensureOwnStudentProgress(studentProfile = {}, options = {}) {
        await this.init();
        let query = this.client.rpc('get_own_student_progress_v2');
        if (options.signal && typeof query.abortSignal === 'function') query = query.abortSignal(options.signal);
        const { data, error } = await query;
        if (error) throw error;
        return Array.isArray(data) ? data[0] : data;
    };

    for (const method of LAZY_METHODS) {
        service[method] = async function (payload = {}, options = {}) {
            if (method === 'getOwnArcadeTime') options = payload;
            if (EVENT_PREFIXES[method]) payload.eventId ||= createUniqueId(EVENT_PREFIXES[method]);
            const externalSignal = method === 'startStudentActivityAttempt' ? payload.signal : options.signal;
            try {
                // One deadline covers import, initialization, owner checks and transport.
                return await requestWithTimeout(async signal => {
                    const operation = captureSupabaseOperation(this, { signal, isCurrent: options.isCurrent, context });
                    const { assertCurrent } = operation;
                    await operation.initialize();
                    let studentWriteOperations;
                    try {
                        ({ studentWriteOperations } = await loadOperations());
                    } catch (cause) {
                        assertCurrent();
                        const error = new Error('Activity request files could not load.', { cause });
                        error.code = 'CLIENT_MODULE_LOAD_FAILED';
                        throw error;
                    }
                    assertCurrent();
                    const operationOptions = { ...options, signal, isCurrent: assertCurrent };
                    const result = method === 'getOwnArcadeTime'
                        ? await studentWriteOperations[method].call(this, operationOptions)
                        : await studentWriteOperations[method].call(this, payload, operationOptions);
                    assertCurrent();
                    return result;
                }, {
                    signal: externalSignal,
                    timeoutMs: options.timeoutMs || (method === 'startStudentActivityAttempt' ? 10000 : 30000),
                    label: 'Student activity request'
                });
            } catch (error) {
                if (error.code === 'REQUEST_ABORTED') error.name = 'AbortError';
                throw error;
            }
        };
    }
}
