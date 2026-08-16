import { supabaseService } from '../supabaseService.js';
import { mapStudentProgressRow } from './supabaseValues.js';

export const studentProgressRepository = {
    async get(userId, options = {}) {
        await supabaseService.init();
        let query = supabaseService.getClient().rpc('get_student_progress_v3', {
            p_user_id: userId
        });
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return Array.isArray(data) ? data[0] : data;
    },
    async getSummary(userId, options = {}) {
        await supabaseService.init();
        let summaryQuery = supabaseService.getClient().rpc('get_own_student_progress_summary_v2');
        if (options.signal && typeof summaryQuery.abortSignal === 'function') {
            summaryQuery = summaryQuery.abortSignal(options.signal);
        }
        const { data: summary, error: summaryError } = await summaryQuery;
        if (summaryError) throw summaryError;
        return Array.isArray(summary) ? summary[0] : summary;
    },
    subscribe(userId, callback) {
        const client = supabaseService.getClient();
        if (!userId || typeof callback !== 'function') return () => {};
        let channel = null;
        let cancelled = false;

        const connect = async () => {
            await client.realtime.setAuth();
            if (cancelled) return;
            channel = client.channel(`student-progress:${userId}`, {
                config: { private: true }
            }).on('broadcast', { event: '*' }, payload => {
                const record = payload?.payload?.record || payload?.record || payload?.new;
                if (record?.user_id === userId) callback(mapStudentProgressRow(record));
            }).subscribe(status => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn(`Student progress realtime status: ${status}`);
                }
            });
        };

        connect().catch(error => {
            if (!cancelled) console.warn('Student progress realtime connection failed:', error);
        });

        return () => {
            cancelled = true;
            if (channel) return client.removeChannel(channel);
        };
    }
};
