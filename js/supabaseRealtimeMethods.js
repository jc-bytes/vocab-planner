import { toClientRow } from './supabaseServiceHelpers.js';

export function installSupabaseRealtimeMethods(supabaseService) {
    Object.assign(supabaseService, {
    subscribeToStudentProgress(userId, callback) {
        if (!this.client || !userId || typeof callback !== 'function') return () => {};

        const channel = this.client
            .channel(`student-progress-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'student_progress',
                    filter: `user_id=eq.${userId}`
                },
                payload => {
                    if (!payload?.new) return;
                    callback(toClientRow('student_progress', payload.new));
                }
            )
            .subscribe(status => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn(`Student progress realtime status: ${status}`);
                }
            });

        return () => {
            this.client.removeChannel(channel);
        };
    },
    });
}
