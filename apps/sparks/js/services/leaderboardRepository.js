import { supabaseService } from '../supabaseService.js';
import { mapScoreRow, parseGrade } from './supabaseValues.js';

export const leaderboardRepository = {
    async get(scoreId) {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('scores').select('*').eq('id', scoreId).maybeSingle();
        if (error) throw error;
        return mapScoreRow(data);
    },
    async listTop({ grade, gameId, lowerIsBetter = false, limit = 5 }) {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('scores').select('*')
            .eq('grade_level', parseGrade(grade)).eq('game_id', gameId)
            .order('score', { ascending: lowerIsBetter }).limit(limit);
        if (error) throw error;
        return (data || []).map(mapScoreRow);
    },
    async listForUser(userId) {
        await supabaseService.init();
        const { data, error } = await supabaseService.getClient().from('scores').select('*').eq('user_id', userId);
        if (error) throw error;
        return (data || []).map(mapScoreRow);
    }
};
