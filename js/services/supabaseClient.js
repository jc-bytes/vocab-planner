import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured } from '../../config/supabase-config.js';

export { isSupabaseConfigured };

export const resolveSupabaseConfig = () => window.SUPABASE_CONFIG || SUPABASE_CONFIG;

export function createSupabaseClient() {
    const config = resolveSupabaseConfig();
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or provide window.SUPABASE_CONFIG.');
    }
    return createClient(config.url, config.publishableKey, {
        auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true
        }
    });
}
