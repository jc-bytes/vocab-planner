import { schoolContext } from './schoolContext.js';
import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';
import { cleanUndefined, timestampToIso, toClientTimestamp } from './supabaseValues.js';

export function mapSubjectRow(row) {
    if (!row) return null;
    return {
        id: row.id, slug: row.id, name: row.name || '', color: row.color || '#2563eb',
        sortOrder: Number(row.sort_order) || 0, active: !row.archived,
        createdAt: toClientTimestamp(row.created_at), updatedAt: toClientTimestamp(row.updated_at)
    };
}

export function subjectPayload(subject = {}) {
    return cleanUndefined({
        slug: subject.slug || subject.id,
        name: subject.name,
        color: subject.color,
        sort_order: subject.sortOrder ?? subject.sort_order,
        active: subject.active,
        updated_at: subject.updatedAt ? timestampToIso(subject.updatedAt) : new Date().toISOString()
    });
}

export const subjectsRepository = {
    async list(options = {}) {
        const schoolId = requireSchoolId();
        await supabaseService.init();
        let query = supabaseService.getClient().from('teacher_subjects').select('*').eq('school_id', schoolId);
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapSubjectRow);
    },
    async saveAll(subjects = [], options = {}) {
        const schoolId = requireSchoolId();
        const generation = schoolContext.getGeneration();
        const isCurrent = () => generation === schoolContext.getGeneration() && (!options.isCurrent || options.isCurrent());
        const assertCurrent = () => {
            options.signal?.throwIfAborted();
            if (!isCurrent()) throw new DOMException('Subject save session changed', 'AbortError');
        };
        assertCurrent();
        const { saveTeacherSubjects } = await import('./teacherSubjectWrites.js');
        assertCurrent();
        return saveTeacherSubjects(supabaseService, subjects, schoolId, { ...options, isCurrent });
    }
};
