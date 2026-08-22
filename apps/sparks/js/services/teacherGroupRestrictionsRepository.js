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
        studentAId: row.student_a_id,
        studentBId: row.student_b_id,
        createdAt: row.created_at
    };
}

export const teacherGroupRestrictionsRepository = {
    async list() {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient()
            .from('teacher_group_pair_restrictions')
            .select('id, teacher_id, student_a_id, student_b_id, created_at')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapTeacherGroupRestriction);
    },

    async create(studentAId, studentBId) {
        await supabaseService.init();
        const pair = canonicalStudentPair(studentAId, studentBId);
        const { data, error } = await supabaseService.getClient()
            .from('teacher_group_pair_restrictions')
            .insert({
                student_a_id: pair.studentAId,
                student_b_id: pair.studentBId
            })
            .select('id, teacher_id, student_a_id, student_b_id, created_at')
            .single();
        if (error) throw error;
        return mapTeacherGroupRestriction(data);
    },

    async remove(id) {
        await supabaseService.init();
        const { error } = await supabaseService.getClient()
            .from('teacher_group_pair_restrictions')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
