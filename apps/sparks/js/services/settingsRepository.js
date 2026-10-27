import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';
import { toClientTimestamp, readAuthSessionId } from './supabaseValues.js';
import { requestWithTimeout } from './requestReliability.js';

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

    async save(key, values = {}, options = {}) {
        const schoolId = requireSchoolId();
        const user = supabaseService.currentUser;
        const generation = supabaseService.authIdentityGeneration || 0;
        const sessionId = readAuthSessionId(supabaseService.currentSession);
        const ownerUserId = options.ownerUserId || user?.uid;
        const isCurrent = () => user && user.uid === ownerUserId && supabaseService.currentUser?.uid === ownerUserId
            && (sessionId ? readAuthSessionId(supabaseService.currentSession) === sessionId
                : supabaseService.currentUser === user && generation === (supabaseService.authIdentityGeneration || 0))
            && (!options.isCurrent || options.isCurrent());
        const snapshot = JSON.parse(JSON.stringify(values));
        return requestWithTimeout(async signal => {
            if (!isCurrent()) throw new DOMException('The settings account changed.', 'AbortError');
            const { saveTeacherSetting } = await import('./teacherSettingWrites.js');
            signal.throwIfAborted();
            if (!isCurrent()) throw new DOMException('The settings account changed.', 'AbortError');
            return saveTeacherSetting(supabaseService, key, snapshot, schoolId, { ...options, signal, ownerUserId, isCurrent });
        }, { signal: options.signal, timeoutMs: options.timeoutMs || 30000, label: 'Saving school settings' });
    }
};
