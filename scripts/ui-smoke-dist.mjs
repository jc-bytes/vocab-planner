import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import process from 'node:process';

const host = process.env.UI_SMOKE_DIST_HOST || '127.0.0.1';
const requestedPort = Number(process.env.UI_SMOKE_DIST_PORT || 4174);
const outDir = process.env.UI_SMOKE_DIST_DIR || 'dist-desktop';

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: process.cwd(),
            env: options.env || process.env,
            stdio: options.stdio || 'inherit'
        });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

function requestOk(url) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
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

async function waitForServer(url, timeoutMs = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await requestOk(url)) return true;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
}

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close(() => resolve(true));
        });
        server.listen(port, host);
    });
}

async function findPort(startPort) {
    for (let port = startPort; port < startPort + 50; port += 1) {
        if (await isPortAvailable(port)) return port;
    }
    throw new Error(`Could not find an available preview port from ${startPort}.`);
}

async function ensureDist() {
    if (process.env.UI_SMOKE_DIST_REUSE === '1' && existsSync(outDir)) return;
    await runCommand('npm', ['run', 'desktop:build:web']);
}

async function main() {
    await ensureDist();
    const port = await findPort(requestedPort);
    const baseUrl = `http://${host}:${port}`;
    const preview = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--host', host, '--port', String(port), '--strictPort'], {
        cwd: process.cwd(),
        stdio: 'ignore'
    });

    try {
        if (!(await waitForServer(`${baseUrl}/teacher.html`, 10000))) {
            throw new Error(`Could not start Vite preview at ${baseUrl}`);
        }
        await runCommand('npm', ['run', 'test:ui:smoke'], {
            env: {
                ...process.env,
                UI_SMOKE_BASE_URL: baseUrl
            }
        });
    } finally {
        preview.kill();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
