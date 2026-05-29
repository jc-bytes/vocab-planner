import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured } from '../../config/supabase-config.js';

export { isSupabaseConfigured };

export const resolveSupabaseConfig = () => window.SUPABASE_CONFIG || SUPABASE_CONFIG;

export function createSupabaseClient() {
    const config = resolveSupabaseConfig();
    return createClient(config.url, config.publishableKey, {
        auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true
        }
    });
}
