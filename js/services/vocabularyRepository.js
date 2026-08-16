import { supabaseService } from '../supabaseService.js';
import { cleanUndefined, timestampToIso, toClientTimestamp } from './supabaseValues.js';

export function mapVocabularyRow(row) {
    if (!row) return null;
    return {
        id: row.id, name: row.name || '', description: row.description || '', grades: row.grades || [],
        subjectSlug: row.subject_slug || 'technology', assignedDate: row.assigned_date || '',
        trimester: row.trimester || '', month: row.month || '', week: row.week || '',
        activitySettings: row.activity_settings || {}, words: row.words || [], ownerId: row.owner_id || null,
        createdAt: toClientTimestamp(row.created_at), updatedAt: toClientTimestamp(row.updated_at)
    };
}

export function mapVocabularyMetadata(record) {
    if (!record) return null;
    return {
        id: record.id,
        name: record.name || '',
        description: record.description || '',
        grades: record.grades || [],
        subjectSlug: record.subjectSlug || 'technology',
        assignedDate: record.assignedDate || '',
        trimester: record.trimester || '',
        month: record.month || '',
        week: record.week || '',
        activitySettings: record.activitySettings || {},
        wordCount: Number(record.wordCount) || 0,
        ownerId: record.ownerId || null,
        createdAt: toClientTimestamp(record.createdAt),
        updatedAt: toClientTimestamp(record.updatedAt),
        metadataOnly: true
    };
}

export function vocabularyPayload(vocabulary = {}, id = null) {
    return cleanUndefined({
        id: id || vocabulary.id,
        name: vocabulary.name,
        description: vocabulary.description,
        grades: Array.isArray(vocabulary.grades) ? vocabulary.grades.map(String) : vocabulary.grade ? [String(vocabulary.grade)] : undefined,
        subject_slug: vocabulary.subjectSlug || vocabulary.subject_slug || vocabulary.subject || 'technology',
        assigned_date: (vocabulary.assignedDate ?? vocabulary.assigned_date) === '' ? null : vocabulary.assignedDate ?? vocabulary.assigned_date,
        trimester: vocabulary.trimester,
        month: vocabulary.month,
        week: vocabulary.week === '' || vocabulary.week === null || vocabulary.week === undefined ? null : Number.parseInt(String(vocabulary.week), 10),
        activity_settings: vocabulary.activitySettings,
        words: vocabulary.words,
        owner_id: vocabulary.ownerId,
        updated_at: vocabulary.updatedAt ? timestampToIso(vocabulary.updatedAt) : undefined
    });
}

export const vocabularyRepository = {
    async listMetadata() {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().rpc('list_vocabulary_metadata_v1');
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map(mapVocabularyMetadata);
    },
    async list() {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('vocabularies').select('*');
        if (error) throw error;
        return (data || []).map(mapVocabularyRow);
    },
    async get(id, options = {}) {
        await supabaseService.init();
        let query = supabaseService.getClient().from('vocabularies').select('*').eq('id', id).maybeSingle();
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return mapVocabularyRow(data);
    },
    async save(id, vocabulary = {}) {
        await supabaseService.init();
        const payload = vocabularyPayload({ ...vocabulary, updatedAt: vocabulary.updatedAt || new Date().toISOString() }, id);
        const { error } = await supabaseService.getClient()
            .from('vocabularies').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        return { id, ...vocabulary };
    },
    async update(id, patch = {}) {
        await supabaseService.init();
        const { id: _id, ...payload } = vocabularyPayload({ ...patch, updatedAt: patch.updatedAt || new Date().toISOString() }, id);
        const { data, error } = await supabaseService.getClient()
            .from('vocabularies').update(payload).eq('id', id).select('*').maybeSingle();
        if (error) throw error;
        if (data) return mapVocabularyRow(data);
        return this.save(id, patch);
    },
    async remove(id) {
        await supabaseService.init();
        const { error } = await supabaseService.getClient().from('vocabularies').delete().eq('id', id);
        if (error) throw error;
    }
};
