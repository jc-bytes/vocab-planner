import { supabaseService } from '../supabaseService.js';
import { mapProfileRow, timestampToIso } from './supabaseValues.js';
import { leaderboardRepository } from './leaderboardRepository.js';

export const teacherExportRepository = {
    async getStudentProgress(userId) {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().rpc('get_student_progress_v3', {
            p_user_id: userId
        });
        if (error) throw error;
        return Array.isArray(data) ? data[0] : data;
    },
    async getProfile(userId) {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('profiles').select('*').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return mapProfileRow(data);
    },
    listScores(userId) {
        return leaderboardRepository.listForUser(userId);
    },
    async logExport(record = {}) {
        await supabaseService.init();
        const payload = {
            teacher_id: record.teacherId || null, data_types: record.dataTypes || [],
            student_count: record.studentCount || 0, format: record.format || 'json',
            filename: record.filename || '', metadata: record.metadata || {},
            timestamp: timestampToIso(record.timestamp)
        };
        const { data, error } = await supabaseService.getClient().from('export_logs').insert(payload).select('*').single();
        if (error) throw error;
        return data;
    }
};
