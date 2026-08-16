import { supabaseService } from '../supabaseService.js';
import { mapStudentProgressRow } from './supabaseValues.js';

export const studentProgressRepository = {
    async get(userId, options = {}) {
        await supabaseService.init();
        let query = supabaseService.getClient()
            .from('student_progress').select('*').eq('user_id', userId).maybeSingle();
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return mapStudentProgressRow(data);
    },
    subscribe(userId, callback) {
        const client = supabaseService.getClient();
        if (!userId || typeof callback !== 'function') return () => {};
        const channel = client.channel(`student-progress-${userId}`).on('postgres_changes', {
            event: '*', schema: 'public', table: 'student_progress', filter: `user_id=eq.${userId}`
        }, payload => {
            if (payload?.new) callback(mapStudentProgressRow(payload.new));
        }).subscribe(status => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`Student progress realtime status: ${status}`);
            }
        });
        return () => client.removeChannel(channel);
    }
};
