export const SUPABASE_CONFIG = {
    url: 'https://ifofhiypzffruzhiukst.supabase.co',
    publishableKey: 'sb_publishable_xsZ8dNhTjAwDra48jyOujA_Kd2oztMh'
};

export const isSupabaseConfigured = () => {
    const config = window.SUPABASE_CONFIG || SUPABASE_CONFIG;
    return Boolean(
        config.url &&
        config.publishableKey &&
        !config.url.includes('YOUR_PROJECT_REF') &&
        !config.publishableKey.includes('YOUR_SUPABASE')
    );
};
