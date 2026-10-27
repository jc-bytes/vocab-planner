import { normalizeProfile, toClientTimestamp } from './services/supabaseValues.js';
import { DEFAULT_COIN_DATA } from './studentProgressDefaults.js';

function normalizeTeacherProgressRecord(record, { detailed = false } = {}) {
    if (!record) return null;
    const studentProfile = normalizeProfile(record.studentProfile || {});
    return {
        ...record,
        id: record.id || record.userId,
        userId: record.userId || record.id,
        email: record.email || studentProfile.email,
        role: record.role || 'student',
        mustChangePassword: Boolean(record.mustChangePassword),
        studentProfile,
        units: detailed ? (record.units || {}) : undefined,
        coins: Number(record.coins) || 0,
        coinData: record.coinData || { ...DEFAULT_COIN_DATA },
        totalXp: Number(record.totalXp) || 0,
        version: Number(record.version) || 0,
        createdAt: toClientTimestamp(record.createdAt),
        updatedAt: toClientTimestamp(record.updatedAt),
        progressDetailLoaded: detailed
    };
}

    async function runTeacherRpc(service, operation, name, params) {
    operation.assertCurrent();
    let query = service.client.rpc(name, params);
    if (operation.signal && typeof query.abortSignal === 'function') query = query.abortSignal(operation.signal);
    const result = await query;
    operation.assertCurrent();
    return result;
}

export const teacherProfileOperations = Object.freeze({
    async listStudentProgressSummaries(operation, {
        limit = 100,
        offset = 0,
        grade = null,
        section = null,
        search = null
    } = {}) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        const pageLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 200);
        const pageOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
        const { data, error } = await runTeacherRpc(this, operation, 'list_student_progress_summaries_school_v1', { p_school_id: schoolId,
            p_limit: pageLimit,
            p_offset: pageOffset,
            p_grade: grade === null || grade === '' ? null : Number.parseInt(grade, 10),
            p_section: section || null,
            p_search: search || null
        });
        if (error) throw error;
        const page = Array.isArray(data) ? data[0] : data;
        return {
            items: (page?.items || []).map(item => normalizeTeacherProgressRecord(item)),
            total: Number(page?.total) || 0,
            limit: Number(page?.limit) || pageLimit,
            offset: Number(page?.offset) || pageOffset
        };
    },
    async getWordHuntReviewData(operation) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        const { data, error } = await runTeacherRpc(this, operation, 'list_word_hunt_reviews_school_v1', { p_school_id: schoolId });
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        return rows.map(row => normalizeTeacherProgressRecord(row, { detailed: true }));
    },
    async listStudentIdentityRoster(operation) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        const { data, error } = await runTeacherRpc(this, operation, 'list_student_identity_roster_school_v1', { p_school_id: schoolId });
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        return rows.map(row => normalizeTeacherProgressRecord(row));
    },
    async getStudentRosterFilters(operation) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        const { data, error } = await runTeacherRpc(this, operation, 'list_student_roster_filters_school_v1', { p_school_id: schoolId });
        if (error) throw error;
        const filters = Array.isArray(data) ? data[0] : data;
        return {
            grades: (filters?.grades || []).map(String),
            classes: (filters?.classes || []).map(item => ({
                grade: String(item?.grade || ''),
                section: String(item?.section || '')
            })).filter(item => item.grade && item.section)
        };
    },
    async getTeacherDashboardAnalytics(operation, { grade = null } = {}) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        const { data, error } = await runTeacherRpc(this, operation, 'get_teacher_dashboard_analytics_school_v1', { p_school_id: schoolId,
            p_grade: grade === null || grade === '' ? null : Number.parseInt(grade, 10)
        });
        if (error) throw error;
        const analytics = Array.isArray(data) ? data[0] : data;
        return {
            totalStudents: Number(analytics?.totalStudents) || 0,
            activeStudents: Number(analytics?.activeStudents) || 0,
            averageCoins: Number(analytics?.averageCoins) || 0,
            availableGrades: (analytics?.availableGrades || []).map(String),
            gradeCounts: analytics?.gradeCounts || {},
            coinDistribution: (analytics?.coinDistribution || []).map(value => Number(value) || 0),
            activities: analytics?.activities || {},
            recentActivities: analytics?.recentActivities || []
        };
    },
    async getStudentProgressForTeacher(operation, userId, options = {}) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        let query = this.client.rpc('get_student_progress_school_v3', { p_school_id: schoolId, p_user_id: userId });
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return normalizeTeacherProgressRecord(Array.isArray(data) ? data[0] : data, { detailed: true });
    },
    async setStudentActivityLateOverride(operation, attemptId, { excused, reason = '' } = {}) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        const { data, error } = await runTeacherRpc(this, operation, 'set_student_activity_late_override_v1', {
            p_attempt_id: attemptId,
            p_excused: Boolean(excused),
            p_reason: String(reason || '').trim()
        });
        if (error) throw error;
        return Array.isArray(data) ? data[0] : data;
    },
    async getStudentsProgressForTeacher(operation, userIds = [], { signal } = {}) {
        const schoolId = operation.schoolId;
        operation.assertCurrent();
        signal?.throwIfAborted();
        const ids = Array.from(new Set(userIds.filter(Boolean)));
        if (ids.length === 0) return [];
        if (ids.length > 200) throw new Error('A maximum of 200 students can be loaded at once.');
        let request = this.client.rpc('get_students_progress_by_ids_school_v1', { p_school_id: schoolId,
            p_user_ids: ids
        });
        if (signal && typeof request.abortSignal === 'function') request = request.abortSignal(signal);
        const { data, error } = await request;
        signal?.throwIfAborted();
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        return rows.map(row => normalizeTeacherProgressRecord(row, { detailed: true }));
    },
    async resetStudentPassword(operation, userId) {
        operation.assertCurrent();
        const { data, error } = await this.client.functions.invoke('reset-student-password', {
            body: { userId }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    },
    async createStudentAccount(operation, profile, password) {
        operation.assertCurrent();
        const normalized = normalizeProfile(profile);
        const { data, error } = await this.client.functions.invoke('create-student-account', {
            body: {
                firstName: normalized.firstName,
                lastName: normalized.lastName,
                email: normalized.email,
                grade: normalized.grade,
                section: normalized.group,
                password
            }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    }
});
