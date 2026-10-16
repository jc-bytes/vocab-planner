import test from 'node:test';
import assert from 'node:assert/strict';
import { readSectionQuery } from '../js/services/sectionRead.js';

test('a stalled read settles at its deadline and aborts its transport', async () => {
    let signal;
    const query = {abortSignal(value) {signal = value; return new Promise(() => {});}};
    await assert.rejects(readSectionQuery(query, {timeoutMs:10}), error => error.code === 'REQUEST_TIMEOUT');
    assert.equal(signal.aborted, true);
});
test('leaving a section cancels its read', async () => {
    const controller = new AbortController();
    let transport;
    const query = {abortSignal(signal) { transport = signal; return new Promise(() => {}); }};
    const pending = readSectionQuery(query, {signal:controller.signal});
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(transport.aborted, true);
});

test('read failures preserve the HTTP status needed to clear revoked content', async () => {
    const result = await readSectionQuery(Promise.resolve({status:403,error:{message:'Access changed'}}));
    assert.equal(result.error.status, 403);
});
