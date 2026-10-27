import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { ensureViteServer, requestOk, waitForServer } from '../scripts/lib/local-vite-server.mjs';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const studentHtml = '<!DOCTYPE html><title>Vocabulary Master - Student</title><div id="login-view"></div>';

async function fixture(t, { status = 200, body = studentHtml } = {}) {
    const server = http.createServer((request, response) => {
        response.writeHead(status, { 'content-type': 'text/html' });
        response.end(body);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;
    return { server, port, host: '127.0.0.1', baseUrl: `http://127.0.0.1:${port}`, probePath: '/student.html', cwd };
}

test('404 and forbidden responses are not ready UI servers', async t => {
    for (const status of [404, 403, 500]) {
        const options = await fixture(t, { status });
        assert.equal(await requestOk(`${options.baseUrl}/student.html`), false);
    }
});

test('explicit external reuse verifies the requested Sparks page', async t => {
    const options = await fixture(t);
    assert.equal(await ensureViteServer({ ...options, external: true }), null);
});

test('external reuse rejects an unrelated successful HTTP listener', async t => {
    const options = await fixture(t, { body: '<title>Another application</title>' });
    await assert.rejects(ensureViteServer({ ...options, external: true }), /Sparks|expected UI/i);
});

test('external reuse rejects 404 even when its body contains Sparks markup', async t => {
    const options = await fixture(t, { status: 404 });
    await assert.rejects(ensureViteServer({ ...options, external: true }), /not reachable|expected UI/i);
});

test('owned mode rejects an occupied port and leaves that listener running', async t => {
    const options = await fixture(t, { status: 404 });
    await assert.rejects(ensureViteServer(options), /already in use|occupied/i);
    assert.equal(options.server.listening, true);
});

test('owned mode does not silently reuse an existing Sparks server', async t => {
    const options = await fixture(t);
    await assert.rejects(ensureViteServer(options), /already in use|occupied/i);
});

test('owned Vite process serves this checkout and kill releases its port', async t => {
    const options = await fixture(t);
    await new Promise(resolve => options.server.close(resolve));
    const server = await ensureViteServer(options);
    t.after(() => { if (server.exitCode === null && server.signalCode === null) server.kill(); });
    assert.ok(server.pid);
    assert.equal(await waitForServer(`${options.baseUrl}/student.html`), true);
    const exited = once(server, 'exit');
    server.kill();
    await exited;
    assert.equal(await requestOk(`${options.baseUrl}/student.html`), false);
});

test('failed process creation rejects without hanging during cleanup', { timeout: 3000 }, async t => {
    const options = await fixture(t);
    await new Promise(resolve => options.server.close(resolve));
    await assert.rejects(ensureViteServer({ ...options, cwd: `${cwd}/missing-ui-test-directory` }), /ENOENT/);
});


test('owned Vite recognizes forced-color readiness and still serves this checkout', { timeout: 15000 }, async t => {
    const previous = Object.fromEntries(['FORCE_COLOR', 'NO_COLOR', 'CI'].map(key => [key, process.env[key]]));
    let server;
    try {
        // Tooling often sets NO_COLOR locally; GitHub's colored banner inserts
        // terminal control sequences between "Local", its colon and the URL.
        delete process.env.NO_COLOR;
        process.env.FORCE_COLOR = '1';
        process.env.CI = 'true';
        const options = await fixture(t);
        await new Promise(resolve => options.server.close(resolve));
        server = await ensureViteServer(options);
        assert.ok(server.pid);
        assert.equal(await waitForServer(`${options.baseUrl}/student.html`), true);
    } finally {
        if (server && server.exitCode === null && server.signalCode === null) {
            const stopped = once(server, 'close');
            server.kill();
            await stopped;
        }
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});
