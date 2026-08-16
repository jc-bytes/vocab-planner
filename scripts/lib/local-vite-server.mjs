import { spawn } from 'node:child_process';
import http from 'node:http';

export function requestOk(url) {
    return new Promise(resolve => {
        const request = http.get(url, response => {
            response.resume();
            resolve(response.statusCode >= 200 && response.statusCode < 500);
        });
        request.on('error', () => resolve(false));
        request.setTimeout(1000, () => {
            request.destroy();
            resolve(false);
        });
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
    args = ['vite', '--host', host, '--port', String(port), '--strictPort']
}) {
    const probeUrl = `${baseUrl}${probePath}`;
    if (await requestOk(probeUrl)) return null;
    if (external) throw new Error(`Configured UI server is not reachable: ${baseUrl}`);

    const server = spawn('npx', args, {
        cwd: process.cwd(),
        stdio: 'ignore'
    });
    if (await waitForServer(probeUrl)) return server;

    server.kill();
    throw new Error(`Could not start local UI server at ${baseUrl}`);
}
