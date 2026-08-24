export const SUPABASE_CONFIG = {
    url: import.meta.env?.VITE_SUPABASE_URL || '',
    publishableKey: import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || ''
};

export const PRODUCTION_SUPABASE_URL = 'https://ifofhiypzffruzhiukst.supabase.co';

export function isValidSupabaseConfig(config = {}) {
    const url = String(config.url || '');
    const publishableKey = String(config.publishableKey || '');
    return Boolean(
        url &&
        publishableKey &&
        !url.includes('YOUR_PROJECT_REF') &&
        !publishableKey.includes('YOUR_SUPABASE') &&
        !publishableKey.includes('your_key_here')
    );
}

export const isSupabaseConfigured = () => {
    const config = globalThis.window?.SUPABASE_CONFIG || SUPABASE_CONFIG;
    return isValidSupabaseConfig(config);
};
