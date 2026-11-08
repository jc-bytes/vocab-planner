import { readSectionQuery } from './sectionRead.js';
import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';
import { schoolContext } from './schoolContext.js';
import { runOwnedMutation, serviceMutationIdentity } from './ownedMutation.js';

const write = (build, options) => runOwnedMutation(async () => {
    await supabaseService.init();
    return supabaseService.getClient();
}, build, { getIdentity: () => serviceMutationIdentity(supabaseService), context: schoolContext, ...options });
import { cleanUndefined, timestampToIso, toClientTimestamp } from './supabaseValues.js';

export function mapVocabularyRow(row) {
    if (!row) return null;
    return {
        importProvenance: row.import_provenance, contentRevision: row.content_revision, archivedAt: row.archived_at, id: row.id, name: row.name || '', description: row.description || '', grades: row.grades || [],
        subjectSlug: row.teacher_subject_id || row.subject_slug || 'technology', assignedDate: row.assigned_date || '',
        trimester: row.trimester || '', month: row.month || '', week: row.week || '',
        activitySettings: row.activity_settings || {}, words: row.words || [], ownerId: row.owner_id || null,
        createdAt: toClientTimestamp(row.created_at), updatedAt: toClientTimestamp(row.updated_at)
    };
}

export function mapVocabularyMetadata(record) {
    if (!record) return null;
    return {
        id: record.id, contentRevision: record.contentRevision,
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
        subject_slug: 'technology',
        teacher_subject_id: /^[0-9a-f-]{36}$/.test(vocabulary.subjectSlug || '') ? vocabulary.subjectSlug : undefined,
        assigned_date: (vocabulary.assignedDate ?? vocabulary.assigned_date) === '' ? null : vocabulary.assignedDate ?? vocabulary.assigned_date,
        trimester: vocabulary.trimester,
        month: vocabulary.month,
        week: vocabulary.week === '' || vocabulary.week === null || vocabulary.week === undefined ? null : Number.parseInt(String(vocabulary.week), 10),
        import_provenance: vocabulary.importProvenance,
        activity_settings: vocabulary.activitySettings,
        words: vocabulary.words,
        owner_id: vocabulary.ownerId,
        updated_at: vocabulary.updatedAt ? timestampToIso(vocabulary.updatedAt) : undefined
    });
}

export const vocabularyRepository = {
    async listMetadata(options = {}) {
        const schoolId = requireSchoolId();
        await supabaseService.init();
        let query = supabaseService.getClient().rpc('list_vocabulary_metadata_school_v1', { p_school_id: schoolId });
        const { data, error } = await readSectionQuery(query, options);
        if (error) throw error;
        return (Array.isArray(data) ? data : []).map(mapVocabularyMetadata);
    },
    async list() {
        const schoolId = requireSchoolId();
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('vocabularies').select('*').eq('school_id', schoolId).is('archived_at', null);
        if (error) throw error;
        return (data || []).map(mapVocabularyRow);
    },
    async get(id, options = {}) {
        const schoolId = requireSchoolId();
        await supabaseService.init();
        let query = supabaseService.getClient().from('vocabularies').select('*').eq('school_id', schoolId).eq('id', id).maybeSingle();
        const { data, error } = await readSectionQuery(query, options);
        if (error) throw error;
        return mapVocabularyRow(data);
    },
    async save(id, vocabulary = {}, options) {
        const schoolId = requireSchoolId();
        const payload = JSON.parse(JSON.stringify(vocabularyPayload({ ...vocabulary, updatedAt: vocabulary.updatedAt || new Date().toISOString() }, id)));
        const data = await write(client => client.rpc('save_vocabulary_revision_v1', {
            p_school_id: schoolId, p_id: id, p_payload: payload,
            p_expected_revision: vocabulary.contentRevision ?? 0,
            p_request_key: options?.requestKey || crypto.randomUUID()
        }), options);
        return mapVocabularyRow(data);
    },
    async update(id, patch = {}, options) {
        if (!Number.isInteger(patch.contentRevision)) throw new Error('Reopen the vocabulary before saving changes.');
        return this.save(id, patch, options);
    },
    async updateVocabularyPlacements(updates = [], options) {
        const schoolId = requireSchoolId();
        const payload = updates.map(update => ({
            id: update.id, expected_revision: update.contentRevision,
            assigned_date: update.assignedDate || null,
            trimester: update.trimester || '',
            month: update.month || '',
            week: update.week === '' || update.week === null || update.week === undefined
                ? null
                : Number.parseInt(String(update.week), 10),
            updated_at: timestampToIso(update.updatedAt)
        }));
        if (payload.length === 0) return { requested: 0, updated: 0 };
        const data = await write(client => client.rpc('update_vocabulary_placements_school_v1', {
            p_school_id: schoolId,
            p_updates: payload
        }), options);
        const result = Array.isArray(data) ? data[0] : data;
        return {
            requested: Number(result?.requested) || 0,
            updated: Number(result?.updated) || 0
        };
    },
    async remove(id, options) {
        const schoolId = requireSchoolId();
        const identity = serviceMutationIdentity(supabaseService), generation = schoolContext.getGeneration();
        const assertCurrent = () => {
            const now = serviceMutationIdentity(supabaseService);
            if (now.userId !== identity.userId || now.generation !== identity.generation || schoolContext.getGeneration() !== generation)
                throw new DOMException('The account or school changed. Start this action again.', 'AbortError');
        };
        const { classroomRepository } = await import('./classroomRepository.js');
        assertCurrent();
        const request = { operation: 'archive', assignmentIds: [] };
        const preview = await classroomRepository.previewVocabularyChange(id, request);
        assertCurrent();
        return classroomRepository.applyVocabularyChange(id, request, preview.token, crypto.randomUUID(), { ...options, ownerUserId: identity.userId });
    }
};
