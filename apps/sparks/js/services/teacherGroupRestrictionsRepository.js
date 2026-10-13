import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';

export function canonicalStudentPair(studentAId, studentBId) {
    const pair = [String(studentAId || ''), String(studentBId || '')].sort();
    return { studentAId: pair[0], studentBId: pair[1] };
}

export function mapTeacherGroupRestriction(row) {
    if (!row) return null;
    return {
        id: row.id,
        teacherId: row.teacher_id,
        schoolId: row.school_id,
        studentAId: row.student_a_id,
        studentBId: row.student_b_id,
        createdAt: row.created_at
    };
}

export function createTeacherGroupRestrictionsRepository(getClient, getSchoolId = requireSchoolId) {
 return {
    async list() {
        const schoolId = getSchoolId();
        const client = await getClient();
        const { data, error } = await client
            .from('teacher_group_pair_restrictions')
            .select('id, school_id, teacher_id, student_a_id, student_b_id, created_at')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapTeacherGroupRestriction);
    },

    async create(studentAId, studentBId) {
        const schoolId = getSchoolId();
        const client = await getClient();
        const pair = canonicalStudentPair(studentAId, studentBId);
        const { data, error } = await client
            .from('teacher_group_pair_restrictions')
            .insert({
                school_id: schoolId,
                student_a_id: pair.studentAId,
                student_b_id: pair.studentBId
            })
            .select('id, school_id, teacher_id, student_a_id, student_b_id, created_at')
            .single();
        if (error) throw error;
        return mapTeacherGroupRestriction(data);
    },

    async remove(id) {
        const schoolId = getSchoolId();
        const client = await getClient();
        const { error } = await client
            .from('teacher_group_pair_restrictions')
            .delete()
            .eq('id', id)
            .eq('school_id', schoolId);
        if (error) throw error;
    }
 };
}

export const teacherGroupRestrictionsRepository = createTeacherGroupRestrictionsRepository(async () => {
    await supabaseService.init();
    return supabaseService.getClient();
});
