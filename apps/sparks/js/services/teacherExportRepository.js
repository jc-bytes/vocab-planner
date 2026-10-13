import { schoolContext } from './schoolContext.js';
import { supabaseService } from '../supabaseService.js';
import { mapProfileRow, timestampToIso } from './supabaseValues.js';

// Account-wide Arcade scores and wallet totals have no school provenance.
// Export only school-attributable educational records.
function withoutAccountRewards(record) {
    const result = { ...record };
    for (const key of ['coins', 'coinData', 'coinHistory', 'totalXp', 'version']) delete result[key];
    return result;
}

export function createTeacherExportRepository({ service = supabaseService, context = schoolContext } = {}) {
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
            const result = await operation({ schoolId, signal: controller.signal, assertCurrent });
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
        return scoped(async ({ schoolId, assertCurrent }) => {
        await service.init();
        assertCurrent();
        const ids = new Set(userIds.filter(Boolean));
        const { data, error } = await service.getClient().rpc('list_student_identity_roster_school_v1', { p_school_id: schoolId });
        assertCurrent();
        if (error) throw error;
        return (data || []).filter(row => ids.has(row.userId)).map(row => mapProfileRow({
            user_id: row.userId, role: row.role, email: row.email,
            first_name: row.studentProfile.firstName, last_name: row.studentProfile.lastName,
            grade_level: Number(row.studentProfile.grade) || null, section_letter: row.studentProfile.group,
            must_change_password: row.mustChangePassword, created_at: row.createdAt, updated_at: row.updatedAt
        }));
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
