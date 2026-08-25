import { supabaseService } from '../supabaseService.js';
import { mapProfileRow, mapScoreRow, timestampToIso } from './supabaseValues.js';

export const teacherExportRepository = {
    async getStudentProgressBatch(userIds = []) {
        const ids = Array.from(new Set(userIds.filter(Boolean)));
        const results = [];
        for (let index = 0; index < ids.length; index += 100) {
            results.push(...await supabaseService.getStudentsProgressForTeacher(ids.slice(index, index + 100)));
        }
        return results;
    },
    async getProfiles(userIds = []) {
        await supabaseService.init();
        const ids = Array.from(new Set(userIds.filter(Boolean)));
        const profiles = [];
        for (let index = 0; index < ids.length; index += 100) {
            const { data, error } = await supabaseService.getClient()
                .from('profiles')
                .select('user_id,role,email,first_name,last_name,grade_level,section_letter,must_change_password,created_at,updated_at')
                .in('user_id', ids.slice(index, index + 100));
            if (error) throw error;
            profiles.push(...(data || []).map(mapProfileRow));
        }
        return profiles;
    },
    async listScoresForUsers(userIds = []) {
        await supabaseService.init();
        const ids = Array.from(new Set(userIds.filter(Boolean)));
        const scores = [];
        for (let index = 0; index < ids.length; index += 100) {
            const batch = ids.slice(index, index + 100);
            let offset = 0;
            while (true) {
                const { data, error } = await supabaseService.getClient()
                    .from('scores')
                    .select('id,user_id,name,grade_level,game_id,score,metadata,timestamp,updated_at')
                    .in('user_id', batch)
                    .order('timestamp', { ascending: false })
                    .range(offset, offset + 999);
                if (error) throw error;
                const page = data || [];
                scores.push(...page.map(mapScoreRow));
                if (page.length < 1000) break;
                offset += page.length;
            }
        }
        return scores;
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
