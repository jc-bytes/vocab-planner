export const MAX_SYNC_QUEUE_RECORDS = 250;
export const MAX_SYNC_ATTEMPTS = 5;
export const SYNC_RETRY_BASE_DELAY_MS = 1000;
export const SYNC_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

const RETRYABLE_ERROR_CODES = new Set([
    'OFFLINE',
    'NETWORK_ERROR',
    'REQUEST_TIMEOUT',
    'TIMEOUT',
    'ECONNABORTED',
    'ECONNRESET',
    'ETIMEDOUT'
]);

const TERMINAL_ERROR_CODES = new Set([
    'REQUEST_ABORTED',
    'PGRST116',
    'PGRST301'
]);

function readStatus(error) {
    for (const value of [error?.status, error?.statusCode, error?.context?.status, error?.cause?.status]) {
        const status = Number(value);
        if (Number.isInteger(status) && status > 0) return status;
    }
    return null;
}

export function classifySyncError(error, options = {}) {
    if (options.online === false) {
        return { retryable: true, reason: 'offline', status: null };
    }

    const code = String(error?.code || error?.cause?.code || '').trim().toUpperCase();
    const status = readStatus(error);
    const message = [error?.message, error?.details, error?.hint, error?.cause?.message]
        .map(value => String(value || '').toLowerCase())
        .join(' ');

    if (TERMINAL_ERROR_CODES.has(code)) {
        return { retryable: false, reason: 'cancelled-or-invalid', status };
    }
    if (RETRYABLE_ERROR_CODES.has(code)) {
        return { retryable: true, reason: code.toLowerCase(), status };
    }
    if (status !== null) {
        if ([408, 425, 429].includes(status) || status >= 500) {
            return { retryable: true, reason: `http-${status}`, status };
        }
        if (status >= 400 && status < 500) {
            return { retryable: false, reason: `http-${status}`, status };
        }
    }
    if (/failed to fetch|network(?: request| error)?|load failed|connection|offline|timed? out/.test(message)) {
        return { retryable: true, reason: 'network', status };
    }
    if (/permission|not allowed|unauthori[sz]ed|forbidden|invalid|malformed|outside the accepted|unsupported/.test(message)) {
        return { retryable: false, reason: 'validation-or-authorization', status };
    }
    if (/^(22|23|28|42|P0)/.test(code)) {
        return { retryable: false, reason: 'database-rejected', status };
    }

    // Supabase/PostgREST failures sometimes omit an HTTP status. Unknown errors
    // get bounded retries rather than silently discarding locally saved work.
    return { retryable: true, reason: 'unknown-transient', status };
}

export function getSyncRetryDelayMs(attempts) {
    const exponent = Math.max(0, Math.min(20, Number(attempts) - 1));
    return Math.min(SYNC_RETRY_MAX_DELAY_MS, SYNC_RETRY_BASE_DELAY_MS * (2 ** exponent));
}

export function getSyncActionDedupeKey(type, payload = {}) {
    const eventId = String(payload?.eventId || '').trim();
    if (eventId) return `${type}:event:${eventId}`;
    if (type === 'student-spark-response') {
        const sparkId = String(payload?.sparkId || '').trim();
        if (sparkId) return `${type}:spark:${sparkId}`;
    }
    return '';
}
