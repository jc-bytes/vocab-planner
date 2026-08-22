import { supabaseService } from '../supabaseService.js';
import { cleanUndefined, timestampToIso, toClientTimestamp } from './supabaseValues.js';

export function mapSettingsRow(row) {
    if (!row) return null;
    return { id: row.key, key: row.key, ...(row.value || {}), updatedAt: toClientTimestamp(row.updated_at) };
}

export const settingsRepository = {
    async get(key, options = {}) {
        await supabaseService.init();
        let query = supabaseService.getClient()
            .from('app_settings').select('*').eq('key', key).maybeSingle();
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return mapSettingsRow(data);
    },

    async save(key, values = {}) {
        await supabaseService.init();
        const { id: _id, key: _key, updatedAt, createdAt: _createdAt, ...value } = values;
        const payload = cleanUndefined({
            key,
            value,
            updated_at: updatedAt ? timestampToIso(updatedAt) : new Date().toISOString()
        });
        const { key: _payloadKey, ...updatePayload } = payload;
        const { data: updated, error: updateError } = await supabaseService.getClient()
            .from('app_settings').update(updatePayload).eq('key', key).select('key').maybeSingle();
        if (updateError) throw updateError;
        if (!updated) {
            const { error } = await supabaseService.getClient()
                .from('app_settings').upsert(payload, { onConflict: 'key' });
            if (error) throw error;
        }
        return { key, ...values };
    }
};
