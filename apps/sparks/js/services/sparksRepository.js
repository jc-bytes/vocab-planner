import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';
import { schoolContext } from './schoolContext.js';
import { runOwnedMutation, serviceMutationIdentity } from './ownedMutation.js';

const write = (build, options) => runOwnedMutation(async () => {
    await supabaseService.init();
    return supabaseService.getClient();
}, build, { getIdentity: () => serviceMutationIdentity(supabaseService), context: schoolContext, ...options });
import { cleanUndefined, normalizeTextArray, timestampToIso, toClientTimestamp } from './supabaseValues.js';
import { normalizeSparkCheckMode, normalizeSparkQuestions } from '../sparkCheckModel.js';
import { readCollection } from './readCollection.js';

export function mapSparkRow(row) {
    if (!row) return null;
    return {
        id: row.id, sparkType: row.spark_type || 'cool_fact', title: row.title || '',
        sparkText: row.spark_text || '', whyItMatters: row.why_it_matters || '', question: row.question || '',
        gradeQuestions: row.grade_questions && typeof row.grade_questions === 'object' ? row.grade_questions : {},
        checkMode: normalizeSparkCheckMode(row.check_mode),
        questions: normalizeSparkQuestions(row.questions),
        targetGrades: normalizeTextArray(row.target_grades || ['6', '7', '8', '9']),
        sourceTitle: row.source_title || '', sourceUrl: row.source_url || '',
        subjectSlug: row.teacher_subject_id || row.subject_slug || 'technology', scheduledDate: row.scheduled_date || '',
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
        check_mode: normalizeSparkCheckMode(spark.checkMode ?? spark.check_mode),
        questions: normalizeSparkQuestions(spark.questions),
        target_grades: normalizeTextArray(spark.targetGrades ?? spark.target_grades ?? ['6', '7', '8', '9']),
        source_title: spark.sourceTitle ?? spark.source_title ?? '',
        source_url: spark.sourceUrl ?? spark.source_url ?? '',
        subject_slug: 'technology',
        teacher_subject_id: /^[0-9a-f-]{36}$/.test(spark.subjectSlug || '') ? spark.subjectSlug : undefined,
        scheduled_date: (spark.scheduledDate ?? spark.scheduled_date) || null,
        status: spark.status || 'draft', owner_id: spark.ownerId || spark.owner_id || undefined,
        updated_at: spark.updatedAt ? timestampToIso(spark.updatedAt) : undefined
    });
}

export const sparksRepository = {
    async list(options = {}) {
        const schoolId = requireSchoolId();
        const rows = await readCollection(async () => {
            await supabaseService.init();
            return supabaseService.getClient();
        }, (client, count) => client.from('weekly_sparks').select('*', count)
            .eq('school_id', schoolId).order('id'), options.signal);
        return rows.map(mapSparkRow);
    },
    async listScheduledForStudent({ subjectSlug, onOrAfter = '', onOrBefore, targetGrade = '', limit = 20 }) {
        const schoolId = requireSchoolId();
        await supabaseService.init();
        let query = supabaseService.getClient().from('weekly_sparks').select('*').eq('school_id', schoolId)
            .eq('subject_slug', subjectSlug).eq('status', 'scheduled').lte('scheduled_date', onOrBefore);
        if (onOrAfter) query = query.gte('scheduled_date', onOrAfter);
        if (targetGrade) query = query.contains('target_grades', [String(targetGrade)]);
        query = query.order('scheduled_date', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(limit);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapSparkRow);
    },
    async save(id, spark = {}, options) {
        const schoolId = requireSchoolId();
        const payload = JSON.parse(JSON.stringify(sparkPayload({ ...spark, updatedAt: spark.updatedAt || new Date().toISOString() }, id)));
        await write(client => client.from('weekly_sparks').upsert({ ...payload, school_id: schoolId }, { onConflict: 'id' }), options);
        return { id, ...spark };
    },
    async update(id, patch = {}, options) {
        const schoolId = requireSchoolId();
        const { id: _id, ...payload } = JSON.parse(JSON.stringify(sparkPayload({ ...patch, updatedAt: patch.updatedAt || new Date().toISOString() }, id)));
        const data = await write(client => client.from('weekly_sparks').update(payload).eq('school_id', schoolId).eq('id', id).select('*').maybeSingle(), options);
        if (data) return mapSparkRow(data);
        throw new Error('This material is unavailable in the selected school.');
    }
};
