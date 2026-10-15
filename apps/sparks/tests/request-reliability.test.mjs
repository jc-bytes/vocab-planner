import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWithTimeout } from '../js/services/requestReliability.js';

test('startup deadlines settle even if the transport ignores abort', async () => {
    let signal;
    await assert.rejects(requestWithTimeout(value => { signal = value; return new Promise(() => {}); }, {
        timeoutMs: 10, label: 'School access'
    }), { code: 'REQUEST_TIMEOUT' });
    assert.equal(signal.aborted, true);
});

test('account cancellation settles immediately for an uncooperative request', async () => {
    const controller = new AbortController();
    const pending = requestWithTimeout(() => new Promise(() => {}), { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { code: 'REQUEST_ABORTED' });
});
