import { requireSchoolId } from './services/schoolScope.js';
import { schoolContext } from './services/schoolContext.js';
import { captureSupabaseOperation } from './services/supabaseOperationSession.js';
import { requestWithTimeout } from './services/requestReliability.js';

const METHOD_OPTIONS = Object.freeze({
    listStudentProgressSummaries: 0, getWordHuntReviewData: 0,
    listStudentIdentityRoster: 0, getStudentRosterFilters: 0,
    getTeacherDashboardAnalytics: 0, getStudentProgressForTeacher: 1,
    setStudentActivityLateOverride: 1, getStudentsProgressForTeacher: 1,
    resetStudentPassword: 1, createStudentAccount: 2
});

export function installLazyTeacherProfileMethods(service, {
    loadTeacherOperations = () => import('./supabaseTeacherProfileOperations.js'),
    context = schoolContext
} = {}) {
    for (const [method, optionsIndex] of Object.entries(METHOD_OPTIONS)) {
        service[method] = async function (...args) {
            const options = { ...(args[optionsIndex] || {}) };
            const operationArgs = [...args];
            operationArgs[optionsIndex] = options;
            // Export repositories can provide their already-captured school explicitly.
            const schoolId = method === 'resetStudentPassword' || method === 'createStudentAccount'
                ? context.getSchoolId()
                : options.schoolId || (context === schoolContext ? requireSchoolId() : context.getSchoolId());
            if (!schoolId && method !== 'resetStudentPassword' && method !== 'createStudentAccount') {
                throw new Error('Choose a school before continuing.');
            }
            const operation = captureSupabaseOperation(this, { ...options, context });
            await operation.initialize();
            let teacherProfileOperations;
            try {
                ({ teacherProfileOperations } = await requestWithTimeout(() => loadTeacherOperations(), {
                    signal: options.signal, timeoutMs: options.timeoutMs || 10000, label: 'Loading teacher tools'
                }));
            } catch (error) {
                if (error.code === 'REQUEST_ABORTED') error.name = 'AbortError';
                throw error;
            }
            operation.assertCurrent();
            const result = await teacherProfileOperations[method].call(this, {
                ...operation, schoolId, signal: options.signal
            }, ...operationArgs);
            operation.assertCurrent();
            return result;
        };
    }
}
