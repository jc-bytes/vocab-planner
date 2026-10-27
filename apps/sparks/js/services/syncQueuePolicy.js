export const MAX_SYNC_QUEUE_RECORDS = 250;
export const SYNC_RETRY_BASE_DELAY_MS = 1000;
export const SYNC_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

const RETRYABLE_ERROR_CODES = new Set([
    'OFFLINE',
    'NETWORK_ERROR',
    'REQUEST_TIMEOUT',
    'TIMEOUT',
    'ECONNABORTED',
    'ECONNRESET',
    'ETIMEDOUT',
    'UNIT_WORK_NEWER_DRAFT'
]);

const TERMINAL_ERROR_CODES = new Set([
    'REQUEST_ABORTED',
    'SYNC_OWNER_MISMATCH',
    'PGRST116',
    'PGRST301'
]);

const BUSINESS_REJECTION = /permission|not allowed|unauthori[sz]ed|forbidden|invalid|malformed|outside the accepted|unsupported|(?:assignment|class|material|subject|invitation)(?: is)? unavailable|not accepting (?:work|responses)|not assigned to your grade|not available yet|not enough coins|jwt|sign[ -]?in|signed in|authenticat/i;

function readStatus(error) {
    for (const value of [error?.status, error?.statusCode, error?.context?.status, error?.cause?.status]) {
        const status = Number(value);
        if (Number.isInteger(status) && status > 0) return status;
    }
    return null;
}

export function classifySyncError(error, options = {}) {
    const code = String(error?.code || error?.cause?.code || '').trim().toUpperCase();
    const status = readStatus(error);
    const message = [error?.message, error?.details, error?.hint, error?.cause?.message]
        .map(value => String(value || '').toLowerCase())
        .join(' ');

    if (code === 'P0001' && String(error?.message || '') === 'The activity was completed too quickly to verify.') {
        return { retryable: true, reason: 'minimum-activity-time', status };
    }
    if (TERMINAL_ERROR_CODES.has(code) || /^(22|23|28|42|P0)/.test(code)) {
        return { retryable: false, reason: 'cancelled-or-invalid', status };
    }
    if (status !== null) {
        if ([408, 425, 429].includes(status) || status >= 500) {
            return { retryable: true, reason: `http-${status}`, status };
        }
        if (status >= 400 && status < 500) {
            return { retryable: false, reason: `http-${status}`, status };
        }
    }
    if (BUSINESS_REJECTION.test(message)) {
        return { retryable: false, reason: 'validation-or-authorization', status };
    }
    if (RETRYABLE_ERROR_CODES.has(code)) {
        return { retryable: true, reason: code.toLowerCase(), status };
    }
    if (options.online === false) {
        return { retryable: true, reason: 'offline', status };
    }
    if (/failed to fetch|network(?: request| error)?|load failed|connection|offline|timed? out/.test(message)) {
        return { retryable: true, reason: 'network', status };
    }
    // Supabase/PostgREST failures sometimes omit an HTTP status. Unknown errors
    // retry with capped backoff rather than silently discarding saved work.
    return { retryable: true, reason: 'unknown-transient', status };
}

export function getSyncRetryDelayMs(attempts) {
    const exponent = Math.max(0, Math.min(20, Number(attempts) - 1));
    return Math.min(SYNC_RETRY_MAX_DELAY_MS, SYNC_RETRY_BASE_DELAY_MS * (2 ** exponent));
}

export function isRecoverableLegacySyncFailure(record = {}) {
    // Older releases retired transient work after five attempts. Unknown or
    // explicitly denied work needs attention rather than an automatic replay.
    const attempts = Number(record.attempts);
    if (record.status !== 'failed' || !Number.isFinite(attempts) || attempts < 5) return false;
    const reason = String(record.failureReason || '');
    const message = String(record.lastError || '');
    const failure = classifySyncError({ message }, { online: true });
    if (!failure.retryable) return false;
    const explicitTransient = ['offline', 'network', 'minimum-activity-time',
        ...[...RETRYABLE_ERROR_CODES].map(code => code.toLowerCase())];
    return explicitTransient.includes(reason) || /^http-(408|425|429|5\d\d)$/.test(reason)
        || (!reason && failure.reason === 'network');
}

export function getSyncActionDedupeKey(type, payload = {}) {
    // Unit saves contain the cumulative snapshot; only the newest one needs replay.
    if (type === 'student-unit-work') {
        const unitKey = String(payload?.unitKey || '').trim();
        if (unitKey) return `${type}:unit:${unitKey}`;
    }
    const eventId = String(payload?.eventId || '').trim();
    if (eventId) return `${type}:event:${eventId}`;
    if (type === 'student-spark-response') {
        const sparkId = String(payload?.sparkId || '').trim();
        if (sparkId) return `${type}:spark:${sparkId}`;
    }
    return '';
}
