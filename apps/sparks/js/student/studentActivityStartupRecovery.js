import { requestWithTimeout } from '../services/requestReliability.js';

const STAGES = new Set(['launcher', 'runtime', 'styles', 'module', 'verification', 'construction']);
const SAFE_CODES = new Set(['CLIENT_MODULE_LOAD_FAILED', 'OFFLINE', 'REQUEST_TIMEOUT', 'REQUEST_ABORTED', 'NETWORK_ERROR', 'ECONNRESET', 'ETIMEDOUT', 'P0001', '42501', '28000', '28P01', 'PGRST301', 'PGRST302']);

function errorStatus(error) {
    const status = Number(error?.status || error?.statusCode || error?.cause?.status);
    return Number.isInteger(status) && status >= 400 && status <= 599 ? status : null;
}

function retryableStartupError(error) {
    const status = errorStatus(error);
    const code = String(error?.code || '').toUpperCase();
    if (['42501', '28000', '28P01', 'PGRST301', 'PGRST302', 'REQUEST_ABORTED', 'OFFLINE'].includes(code)) return false;
    if (status !== null) return status === 408 || status === 429 || status >= 500;
    if (/^(22|23|28|42|P0)/.test(code)) return false;
    return ['REQUEST_TIMEOUT', 'NETWORK_ERROR', 'ECONNRESET', 'ETIMEDOUT'].includes(code)
        || /failed to fetch|networkerror|network request failed|load failed|failed to fetch dynamically imported module/i.test([error?.message, code === 'CLIENT_MODULE_LOAD_FAILED' ? error?.cause?.message : ''].join(' '));
}

function waitBeforeRetry(signal, delay) {
    return new Promise((resolve, reject) => {
        const finish = () => { signal.removeEventListener('abort', cancel); resolve(); };
        const timer = setTimeout(finish, delay);
        const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(signal.reason); };
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
    });
}

export async function runActivityStartupStage(stage, load, options = {}) {
    try {
        return await requestWithTimeout(async signal => {
            for (let attempt = 0; attempt < 2; attempt++) {
                signal.throwIfAborted();
                try { return await load(signal); }
                catch (error) {
                    signal.throwIfAborted();
                    if (attempt || options.retry === false || !retryableStartupError(error)) throw error;
                    await waitBeforeRetry(signal, options.retryDelayMs ?? 200);
                }
            }
        }, { signal: options.signal, timeoutMs: options.timeoutMs || 10000, label: 'Starting activity' });
    } catch (cause) {
        const error = new Error(String(cause?.message || 'Activity startup failed'), { cause });
        error.stage = cause?.code === 'CLIENT_MODULE_LOAD_FAILED' ? 'module' : STAGES.has(stage) ? stage : 'verification';
        error.code = cause?.code;
        error.status = errorStatus(cause);
        throw error;
    }
}

export function getActivityStartupMessage(error) {
    const message = String(error?.message || '');
    if (globalThis.navigator?.onLine === false || error?.code === 'OFFLINE') return 'Reconnect to the internet to start this verified activity.';
    if (error?.code === 'REQUEST_TIMEOUT') return 'The connection is taking too long. Check Wi-Fi and try again.';
    if (error?.code === 'CLIENT_MODULE_LOAD_FAILED' || ['launcher', 'runtime', 'styles', 'module'].includes(error?.stage)) return 'The activity files could not load. Check Wi-Fi and try again. If it keeps happening, reload the page.';
    if (/unknown vocabulary unit|unit key does not match the server catalog/i.test(message)) return 'This vocabulary unit has not been synchronized with the activity server yet.';
    if (/not assigned to your grade/i.test(message)) return 'This vocabulary unit is not assigned to your grade.';
    if (/not available yet/i.test(message)) return 'This vocabulary unit is not available yet.';
    if (/not accepting work|class is unavailable|assignment unavailable|does not belong to this assignment/i.test(message)) return 'This assignment is unavailable or no longer accepting work. Go back to your unit and check with your teacher.';
    if (['PGRST301', 'PGRST302', '28000', '28P01'].includes(error?.code) || errorStatus(error) === 401 || /must be signed in|jwt expired/i.test(message)) return 'Your sign-in needs to be refreshed. Reload the page and sign in again if asked.';
    if (error?.code === '42501' || errorStatus(error) === 403) return 'You do not currently have access to this activity. Go back to your unit and check with your teacher.';
    if (/complete (all required activities|required activity)/i.test(message)) return message;
    if (/too many activity attempts/i.test(message) || errorStatus(error) === 429) return 'The activity server is busy. Wait a moment and try again.';
    return 'The activity server could not start this activity. Try again in a moment.';
}

export function renderActivityStartupError(container, { error, message, retry, back }) {
    const diagnostic = {
        stage: STAGES.has(error?.stage) ? error.stage : 'verification',
        code: SAFE_CODES.has(error?.code) ? error.code : 'UNKNOWN',
        status: errorStatus(error)
    };
    try { globalThis.sessionStorage?.setItem('sparks:last-activity-startup-error', JSON.stringify(diagnostic)); } catch { /* Recovery works when browser storage is unavailable. */ }
    const support = `Support: ${diagnostic.stage} / ${diagnostic.code}${diagnostic.status ? ` / ${diagnostic.status}` : ''}`;
    container.innerHTML = `
        <div class="activity-load-error" role="alert">
            <h2>Activity did not load</h2>
            <p data-activity-error-message></p>
            <p class="activity-startup-support"></p>
            <div class="activity-load-error-actions">
                <button class="btn primary-btn" id="retry-activity-btn" type="button">Try again</button>
                <button class="btn secondary-btn" id="return-to-unit-btn" type="button">Back to unit</button>
            </div>
        </div>`;
    const messageElement = container.querySelector('[data-activity-error-message]');
    if (messageElement) messageElement.textContent = message || getActivityStartupMessage(error);
    const supportElement = container.querySelector('.activity-startup-support');
    if (supportElement) supportElement.textContent = support;
    container.querySelector('#retry-activity-btn')?.addEventListener('click', retry);
    container.querySelector('#return-to-unit-btn')?.addEventListener('click', back);
}
