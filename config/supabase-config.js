export const SUPABASE_CONFIG = {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

export const PRODUCTION_SUPABASE_URL = 'https://ifofhiypzffruzhiukst.supabase.co';

export const isSupabaseConfigured = () => {
    const config = window.SUPABASE_CONFIG || SUPABASE_CONFIG;
    return Boolean(
        config.url &&
        config.publishableKey &&
        !config.url.includes('YOUR_PROJECT_REF') &&
        !config.publishableKey.includes('YOUR_SUPABASE')
    );
};
