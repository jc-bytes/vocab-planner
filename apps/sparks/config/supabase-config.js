export const SUPABASE_CONFIG = {
    url: import.meta.env?.VITE_SUPABASE_URL || '',
    publishableKey: import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || ''
};

export const PRODUCTION_SUPABASE_URL = 'https://ifofhiypzffruzhiukst.supabase.co';

function readLegacyKeyRole(key) {
    const payload = key.split('.')[1];
    if (!payload || typeof globalThis.atob !== 'function') return '';
    try {
        const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        return JSON.parse(globalThis.atob(padded))?.role || '';
    } catch {
        return '';
    }
}

export function isPrivilegedSupabaseKey(value) {
    const key = String(value || '').trim();
    return /^sb_secret_/i.test(key)
        || /service[_-]?role/i.test(key)
        || readLegacyKeyRole(key) === 'service_role';
}

export function isValidSupabaseConfig(config = {}) {
    const url = String(config.url || '').trim();
    const publishableKey = String(config.publishableKey || '').trim();
    return Boolean(
        url &&
        publishableKey &&
        !isPrivilegedSupabaseKey(publishableKey) &&
        !url.includes('YOUR_PROJECT_REF') &&
        !publishableKey.includes('YOUR_SUPABASE') &&
        !publishableKey.includes('your_key_here')
    );
}

export const isSupabaseConfigured = () => {
    const config = globalThis.window?.SUPABASE_CONFIG || SUPABASE_CONFIG;
    return isValidSupabaseConfig(config);
};
