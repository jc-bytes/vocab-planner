import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';
import { toClientTimestamp } from './supabaseValues.js';

export function mapSettingsRow(row) {
    if (!row) return null;
    return { id: row.key, key: row.key, ...(row.value || {}), updatedAt: toClientTimestamp(row.updated_at) };
}

export const settingsRepository = {
    async get(key, options = {}) {
        const schoolId = requireSchoolId();
        await supabaseService.init();
        let query = supabaseService.getClient()
            .rpc('get_school_settings_v1', { p_school_id: schoolId });
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data?.[key] ? { id: key, key, ...data[key] } : null;
    },

    async save(key, values = {}) {
        const schoolId = requireSchoolId();
        const { saveTeacherSetting } = await import('./teacherSettingWrites.js');
        return saveTeacherSetting(supabaseService, key, values, schoolId);
    }
};
