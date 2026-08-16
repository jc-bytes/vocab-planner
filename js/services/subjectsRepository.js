import { supabaseService } from '../supabaseService.js';
import { cleanUndefined, timestampToIso, toClientTimestamp } from './supabaseValues.js';

export function mapSubjectRow(row) {
    if (!row) return null;
    return {
        id: row.slug, slug: row.slug, name: row.name || '', color: row.color || '#2563eb',
        sortOrder: Number(row.sort_order) || 0, active: row.active !== false,
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
        await supabaseService.init();
        let query = supabaseService.getClient().from('subjects').select('*');
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapSubjectRow);
    },
    async saveAll(subjects = []) {
        await supabaseService.init();
        return Promise.all(subjects.map(async subject => {
            const payload = subjectPayload(subject);
            const { slug, ...updatePayload } = payload;
            const { data: updated, error: updateError } = await supabaseService.getClient()
                .from('subjects').update(updatePayload).eq('slug', slug).select('slug').maybeSingle();
            if (updateError) throw updateError;
            if (!updated) {
                const { error } = await supabaseService.getClient()
                    .from('subjects').upsert(payload, { onConflict: 'slug' });
                if (error) throw error;
            }
            return { ...subject, slug };
        }));
    }
};
