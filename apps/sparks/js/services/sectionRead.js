import { requestWithTimeout } from './requestReliability.js';

// Apply only to reads. A timeout must never invite replay of an uncertain write.
export function readSectionQuery(query, options = {}) {
    return requestWithTimeout(signal => typeof query.abortSignal === 'function' ? query.abortSignal(signal) : query, {
        ...options, label: options.label || 'Loading this section'
    }).then(response => {
        if (response?.error && response.status && !response.error.status) response.error.status = response.status;
        return response;
    }).catch(error => {
        if (error.code === 'REQUEST_ABORTED' && options.signal?.aborted) throw options.signal.reason || new DOMException('Request cancelled', 'AbortError');
        throw error;
    });
}
