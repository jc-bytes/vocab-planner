export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

export function createRequestError(message, code, cause = null) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
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
    let rejectAborted;
    const aborted = new Promise((_, reject) => { rejectAborted = reject; });
    const onAbort = () => rejectAborted(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });

    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort(createRequestError(`${label} timed out.`, 'REQUEST_TIMEOUT'));
    }, timeoutMs);

    try {
        return await Promise.race([createRequest(controller.signal), aborted]);
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
        controller.signal.removeEventListener('abort', onAbort);
        externalSignal?.removeEventListener('abort', abortFromExternal);
    }
}
