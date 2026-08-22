import { studentApi } from './studentApi.js';
import { supabaseService } from '../supabaseService.js';

const objectValue = value => (
    value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
);

export function mapSparkResponseRow(row) {
    if (!row) return null;
    return {
        version: Number(row.version) || 2,
        userId: String(row.userId ?? row.user_id ?? ''),
        sparkId: String(row.sparkId ?? row.spark_id ?? ''),
        answers: objectValue(row.answers),
        questionSnapshot: Array.isArray(row.questionSnapshot ?? row.question_snapshot)
            ? [...(row.questionSnapshot ?? row.question_snapshot)]
            : [],
        evaluation: objectValue(row.evaluation),
        isComplete: Boolean(row.isComplete ?? row.is_complete),
        completedAt: String(row.completedAt ?? row.completed_at ?? ''),
        createdAt: String(row.createdAt ?? row.created_at ?? ''),
        updatedAt: String(row.updatedAt ?? row.updated_at ?? ''),
        syncStatus: 'synced'
    };
}

export const sparkResponsesRepository = {
    async listOwn(sparkIds = []) {
        const ids = Array.from(new Set((sparkIds || []).map(id => String(id || '').trim()).filter(Boolean)));
        if (ids.length === 0) return [];
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient()
            .from('student_spark_responses')
            .select('*')
            .in('spark_id', ids)
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSparkResponseRow);
    },

    async listForStudent(userId) {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient()
            .from('student_spark_responses')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSparkResponseRow);
    },

    async submit(state = {}, options = {}) {
        const row = await studentApi.submitStudentSparkResponse({
            sparkId: String(state.sparkId || ''),
            answers: objectValue(state.answers)
        }, options);
        return mapSparkResponseRow(row);
    }
};
