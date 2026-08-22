export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

export function createRequestError(message, code, cause = null) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
}

export function isAbortError(error) {
    return error?.name === 'AbortError'
        || error?.code === 'REQUEST_ABORTED'
        || error?.code === 'REQUEST_TIMEOUT';
}

export async function requestWithTimeout(createRequest, options = {}) {
    const timeoutMs = Number(options.timeoutMs) > 0
        ? Number(options.timeoutMs)
        : DEFAULT_REQUEST_TIMEOUT_MS;
    const label = String(options.label || 'Request');
    const externalSignal = options.signal || null;

    if (externalSignal?.aborted) {
        throw createRequestError(`${label} was cancelled.`, 'REQUEST_ABORTED', externalSignal.reason);
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort(createRequestError(`${label} timed out.`, 'REQUEST_TIMEOUT'));
    }, timeoutMs);

    try {
        return await createRequest(controller.signal);
    } catch (error) {
        if (timedOut) {
            throw createRequestError(`${label} timed out after ${timeoutMs} ms.`, 'REQUEST_TIMEOUT', error);
        }
        if (externalSignal?.aborted || controller.signal.aborted) {
            throw createRequestError(`${label} was cancelled.`, 'REQUEST_ABORTED', error);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', abortFromExternal);
    }
}
