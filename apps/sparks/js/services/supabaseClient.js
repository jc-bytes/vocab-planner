import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured } from '../../config/supabase-config.js';

export { isSupabaseConfigured };

export const resolveSupabaseConfig = () => globalThis.window?.SUPABASE_CONFIG || SUPABASE_CONFIG;

function resolveAuthStorageKey(config) {
    const pathname = globalThis.window?.location?.pathname || '';
    const page = /(?:^|\/)teacher\.html$/i.test(pathname) ? 'teacher' : 'student';
    let project = 'sparks';
    try {
        project = new URL(config.url).host
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || project;
    } catch {
        // Configuration validation will report an invalid URL.
    }
    return `sparks-${project}-${page}-auth-token`;
}

export function createSupabaseClient() {
    const config = resolveSupabaseConfig();
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or provide window.SUPABASE_CONFIG.');
    }
    return createClient(config.url, config.publishableKey, {
        auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
            storageKey: resolveAuthStorageKey(config)
        }
    });
}
