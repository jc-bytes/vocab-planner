import { schoolContext } from './schoolContext.js';
import { supabaseService } from '../supabaseService.js';
import { mapProfileRow, timestampToIso } from './supabaseValues.js';
import { requestWithTimeout } from './requestReliability.js';

// Account-wide Arcade scores and wallet totals have no school provenance.
// Export only school-attributable educational records.
function withoutAccountRewards(record) {
    const result = { ...record };
    for (const key of ['coins', 'coinData', 'coinHistory', 'totalXp', 'version']) delete result[key];
    return result;
}

export function createTeacherExportRepository({ service = supabaseService, context = schoolContext, profileTimeoutMs = 10000 } = {}) {
    async function scoped(operation) {
        const schoolId = context.getSchoolId();
        if (!schoolId) throw new Error('Choose a school before continuing.');
        const accountId = context.getAccountId();
        const generation = context.getGeneration();
        const controller = new AbortController();
        const current = () => context.getSchoolId() === schoolId && context.getAccountId() === accountId && context.getGeneration() === generation;
        const unsubscribe = context.subscribe(() => { if (!current()) controller.abort(); });
        const assertCurrent = () => {
            if (!current() || controller.signal.aborted) throw new DOMException('The school changed. Start the export again.', 'AbortError');
        };
        try {
            const result = await operation({ schoolId, accountId, signal: controller.signal, assertCurrent });
            assertCurrent();
            return result;
        } finally { unsubscribe(); }
    }
    return {
    async getStudentProgressBatch(userIds = []) {
        return scoped(async ({ schoolId, signal, assertCurrent }) => {
            const ids = Array.from(new Set(userIds.filter(Boolean)));
            const results = [];
            for (let index = 0; index < ids.length; index += 100) {
                assertCurrent();
                const batch = await service.getStudentsProgressForTeacher(ids.slice(index, index + 100), { schoolId, signal });
                assertCurrent();
                results.push(...batch.map(withoutAccountRewards));
            }
            return results;
        });
    },
    async getProfiles(userIds = []) {
        return scoped(({ schoolId, accountId, signal, assertCurrent }) => {
            // Invalid IDs never matched the old client-side roster filter. Keep
            // that behavior without sending malformed UUIDs to the new RPC.
            const ids = new Set(userIds.filter(id => typeof id === 'string'
                && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)));
            if (!ids.size) return [];
            const assertActor = () => {
                assertCurrent();
                const knownActor = service.currentUser?.uid || service.currentUser?.id;
                if (!accountId || knownActor && knownActor !== accountId) {
                    throw new DOMException('The account changed. Start the export again.', 'AbortError');
                }
            };
            return requestWithTimeout(async requestSignal => {
                assertActor();
                await service.init();
                requestSignal.throwIfAborted();
                assertActor();
                let query = service.getClient().rpc('list_student_identity_roster_by_ids_school_owned_v1', {
                    p_expected_user_id: accountId, p_school_id: schoolId, p_user_ids: [...ids]
                });
                if (typeof query.abortSignal === 'function') query = query.abortSignal(requestSignal);
                const { data, error } = await query;
                requestSignal.throwIfAborted();
                assertActor();
                if (error) throw error;
                // Keep legacy strict ID matching, server order and mapping.
                return (data || []).filter(row => ids.has(row.userId)).map(row => mapProfileRow({
                    user_id: row.userId, role: row.role, email: row.email,
                    first_name: row.studentProfile.firstName, last_name: row.studentProfile.lastName,
                    grade_level: Number(row.studentProfile.grade) || null, section_letter: row.studentProfile.group,
                    must_change_password: row.mustChangePassword, created_at: row.createdAt, updated_at: row.updatedAt
                }));
            }, { signal, timeoutMs: profileTimeoutMs, label: 'Loading selected student profiles' }).catch(error => {
                if (error.code === 'REQUEST_ABORTED') error.name = 'AbortError';
                throw error;
            });
        });
    },
    async listScoresForUsers() {
        // Kept for older export callers; school exports never query global scores.
        return [];
    },
    async logExport(record = {}) {
        return scoped(async ({ schoolId, assertCurrent }) => {
        if (record.schoolId && record.schoolId !== schoolId) throw new Error('The export belongs to another school.');
        await service.init();
        assertCurrent();
        const payload = {
            school_id: schoolId, teacher_id: record.teacherId || null, data_types: record.dataTypes || [],
            student_count: record.studentCount || 0, format: record.format || 'json',
            filename: record.filename || '', metadata: { ...record.metadata, schoolId },
            timestamp: timestampToIso(record.timestamp)
        };
        const { data, error } = await service.getClient().from('export_logs').insert(payload).select('*').single();
        assertCurrent();
        if (error) throw error;
        return data;
        });
    }
    };
}

export const teacherExportRepository = createTeacherExportRepository();
