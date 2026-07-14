import { supabaseService } from '../supabaseService.js';
import { cleanUndefined, normalizeTextArray, timestampToIso, toClientTimestamp } from './supabaseValues.js';

export function mapSparkRow(row) {
    if (!row) return null;
    return {
        id: row.id, sparkType: row.spark_type || 'cool_fact', title: row.title || '',
        sparkText: row.spark_text || '', whyItMatters: row.why_it_matters || '', question: row.question || '',
        gradeQuestions: row.grade_questions && typeof row.grade_questions === 'object' ? row.grade_questions : {},
        targetGrades: normalizeTextArray(row.target_grades || ['6', '7', '8', '9']),
        sourceTitle: row.source_title || '', sourceUrl: row.source_url || '',
        subjectSlug: row.subject_slug || 'technology', scheduledDate: row.scheduled_date || '',
        status: row.status || 'draft', ownerId: row.owner_id || null,
        createdAt: toClientTimestamp(row.created_at), updatedAt: toClientTimestamp(row.updated_at)
    };
}

export function sparkPayload(spark = {}, id = null) {
    return cleanUndefined({
        id: id || spark.id,
        spark_type: spark.sparkType || spark.spark_type || 'cool_fact', title: spark.title,
        spark_text: spark.sparkText ?? spark.spark_text,
        why_it_matters: spark.whyItMatters ?? spark.why_it_matters,
        question: spark.question,
        grade_questions: spark.gradeQuestions ?? spark.grade_questions ?? {},
        target_grades: normalizeTextArray(spark.targetGrades ?? spark.target_grades ?? ['6', '7', '8', '9']),
        source_title: spark.sourceTitle ?? spark.source_title ?? '',
        source_url: spark.sourceUrl ?? spark.source_url ?? '',
        subject_slug: spark.subjectSlug || spark.subject_slug || 'technology',
        scheduled_date: (spark.scheduledDate ?? spark.scheduled_date) || null,
        status: spark.status || 'draft', owner_id: spark.ownerId || spark.owner_id || null,
        updated_at: spark.updatedAt ? timestampToIso(spark.updatedAt) : undefined
    });
}

export const sparksRepository = {
    async list() {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('weekly_sparks').select('*');
        if (error) throw error;
        return (data || []).map(mapSparkRow);
    },
    async listScheduledForStudent({ subjectSlug, onOrBefore, limit = 40 }) {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('weekly_sparks').select('*')
            .eq('subject_slug', subjectSlug).eq('status', 'scheduled').lte('scheduled_date', onOrBefore)
            .order('scheduled_date', { ascending: false }).order('updated_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return (data || []).map(mapSparkRow);
    },
    async save(id, spark = {}) {
        await supabaseService.init();
        const payload = sparkPayload({ ...spark, updatedAt: spark.updatedAt || new Date().toISOString() }, id);
        const { error } = await supabaseService.getClient()
            .from('weekly_sparks').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        return { id, ...spark };
    },
    async update(id, patch = {}) {
        await supabaseService.init();
        const { id: _id, ...payload } = sparkPayload({ ...patch, updatedAt: patch.updatedAt || new Date().toISOString() }, id);
        const { data, error } = await supabaseService.getClient()
            .from('weekly_sparks').update(payload).eq('id', id).select('*').maybeSingle();
        if (error) throw error;
        if (data) return mapSparkRow(data);
        return this.save(id, patch);
    }
};
