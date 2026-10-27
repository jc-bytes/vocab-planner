import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

function requestPage(url) {
    return new Promise(resolve => {
        const transport = new URL(url).protocol === 'https:' ? https : http;
        const request = transport.get(url, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                // Read only enough HTML to identify the requested application entry.
                if (body.length < 1024 * 1024) body += chunk;
            });
            response.on('error', () => resolve(null));
            response.on('end', () => resolve({ status: response.statusCode, body }));
        });
        request.on('error', () => resolve(null));
        request.setTimeout(1000, () => {
            request.destroy();
            resolve(null);
        });
    });
}

export async function requestOk(url) {
    const page = await requestPage(url);
    return Boolean(page && page.status >= 200 && page.status < 300);
}

async function isExpectedPage(url) {
    const page = await requestPage(url);
    if (!page || page.status < 200 || page.status >= 300) return false;
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/student.html')) {
        return /<title>Vocabulary Master - Student<\/title>/.test(page.body)
            && /\bid=["']login-view["']/.test(page.body);
    }
    if (pathname.endsWith('/teacher.html')) {
        return /<title>Vocabulary Master - Teacher<\/title>/.test(page.body)
            && /\bid=["']teacher-login-view["']/.test(page.body);
    }
    return /<title>Vocabulary Master<\/title>/.test(page.body)
        && /\bclass=["'][^"']*\blanding-container\b/.test(page.body);
}

function portIsOccupied(host, port) {
    return new Promise(resolve => {
        const socket = net.connect({ host, port });
        const finish = result => { socket.destroy(); resolve(result); };
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
        socket.setTimeout(1000, () => finish(true));
    });
}

async function stopServer(server) {
    if (!server.pid || server.exitCode !== null || server.signalCode !== null) return;
    await new Promise(resolve => {
        const timer = setTimeout(() => server.kill('SIGKILL'), 1000);
        server.once('close', () => { clearTimeout(timer); resolve(); });
        server.kill();
    });
}

export async function waitForServer(url, timeoutMs = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await requestOk(url)) return true;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
}

export async function ensureViteServer({
    baseUrl,
    probePath,
    host,
    port,
    external = false,
    cwd = process.cwd(),
    args = ['vite', '--host', host, '--port', String(port), '--strictPort']
}) {
    const probeUrl = `${baseUrl.replace(/\/$/, '')}${probePath}`;
    if (external) {
        if (await isExpectedPage(probeUrl)) return null;
        throw new Error(`Configured UI server is not reachable or does not serve the expected UI for Sparks: ${baseUrl}`);
    }
    const endpoint = new URL(probeUrl);
    const loopbackNames = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
    if (Number(endpoint.port || 80) !== Number(port)
        || (endpoint.hostname !== host && !(loopbackNames.has(endpoint.hostname) && loopbackNames.has(host)))) {
        throw new Error('Owned UI server host/port must match baseUrl; use external: true for an explicitly managed server.');
    }
    if (await portIsOccupied(host, port)) {
        throw new Error(`UI server port ${port} is already in use; choose an unused port or explicitly set external: true.`);
    }

    const [command, ...viteArgs] = args;
    if (command !== 'vite' || !viteArgs.includes('--strictPort')) {
        throw new Error('Owned UI servers must run Vite with --strictPort.');
    }
    if (viteArgs[0] === 'preview') {
        const { verifyOwnedVitePreviewArtifact } = await import('./buildArtifactIdentity.mjs');
        await verifyOwnedVitePreviewArtifact(cwd, viteArgs);
    }
    const require = createRequire(import.meta.url);
    const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
    // Spawn Vite itself so callers own and terminate the actual listener.
    const server = spawn(process.execPath, [vite, ...viteArgs], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let startupError;
    let ready = false;
    let output = '';
    server.once('error', error => { startupError = error; });
    server.stdout.on('data', chunk => {
        output = (output + chunk).slice(-4096);
        ready ||= /Local:\s+https?:\/\//.test(output);
    });
    server.stderr.resume();
    const started = Date.now();
    try {
        while (Date.now() - started < 10000) {
            if (startupError) throw startupError;
            if (server.exitCode !== null || server.signalCode !== null) {
                throw new Error(`Owned Vite UI server exited before readiness at ${baseUrl}.`);
            }
            if (ready && await isExpectedPage(probeUrl)) return server;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Could not start local UI server with the expected Sparks page at ${baseUrl}`);
    } catch (error) {
        await stopServer(server);
        throw error;
    }
}
