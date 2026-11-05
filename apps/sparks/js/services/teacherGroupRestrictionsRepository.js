import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';
import { schoolContext } from './schoolContext.js';
import { runOwnedMutation, serviceMutationIdentity } from './ownedMutation.js';

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

export function createTeacherGroupRestrictionsRepository(getClient, getSchoolId = requireSchoolId, ownership = {}) {
 const write = (build, options) => runOwnedMutation(getClient, build, { ...ownership, ...options });
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

    async create(studentAId, studentBId, options) {
        const schoolId = getSchoolId();
        const pair = canonicalStudentPair(studentAId, studentBId);
        const data = await write(client => client
            .from('teacher_group_pair_restrictions')
            .insert({
                school_id: schoolId,
                student_a_id: pair.studentAId,
                student_b_id: pair.studentBId
            })
            .select('id, school_id, teacher_id, student_a_id, student_b_id, created_at')
            .single(), options);
        return mapTeacherGroupRestriction(data);
    },

    async remove(id, options) {
        const schoolId = getSchoolId();
        await write(client => client
            .from('teacher_group_pair_restrictions')
            .delete()
            .eq('id', id)
            .eq('school_id', schoolId), options);
    }
 };
}

export const teacherGroupRestrictionsRepository = createTeacherGroupRestrictionsRepository(async () => {
    await supabaseService.init();
    return supabaseService.getClient();
}, requireSchoolId, { getIdentity: () => serviceMutationIdentity(supabaseService), context: schoolContext });
